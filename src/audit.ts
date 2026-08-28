import { lstat, readdir, readFile, realpath, stat } from 'node:fs/promises';
import { basename, extname, isAbsolute, relative, resolve } from 'node:path';
import type { LegalSource, LegalStatus } from './domain.js';

export type AuditSeverity = 'critical' | 'high' | 'medium' | 'low';
export type AuditCategory =
  | 'secretos'
  | 'datos_personales'
  | 'logs_sensibles'
  | 'transporte_inseguro'
  | 'cors'
  | 'cookies'
  | 'endpoints_sensibles'
  | 'documentacion';
export type AuditStatus = 'pendiente';

export type AuditReference = Pick<LegalSource, 'id' | 'title' | 'url' | 'verifiedAt'> & {
  status: LegalStatus;
  topic: string;
  rationale: string;
};

export type AuditFinding = {
  id: string;
  ruleId: string;
  severity: AuditSeverity;
  category: AuditCategory;
  path: string;
  line?: number;
  explanation: string;
  evidence: string;
  recommendation: string;
  reference: AuditReference;
  status: AuditStatus;
};

export type AuditControl = {
  id: string;
  category: AuditCategory | 'general';
  title: string;
  description: string;
  referenceIds: string[];
  status: AuditStatus;
};

export type AuditSummary = {
  repository: string;
  rootPath: string;
  generatedAt: string;
  scannedFiles: number;
  scannedDirectories: number;
  skippedEntries: number;
  totalFindings: number;
  findingsBySeverity: Record<AuditSeverity, number>;
  findingsByCategory: Record<AuditCategory, number>;
  limits: {
    maxDepth: number;
    maxFiles: number;
    maxFileSizeBytes: number;
  };
};

export type AuditReport = {
  summary: AuditSummary;
  findings: AuditFinding[];
  controls: AuditControl[];
  references: AuditReference[];
  disclaimer: string;
};

export type AuditOptions = {
  maxDepth?: number;
  maxFiles?: number;
  maxFileSizeBytes?: number;
};

type ScannedFile = {
  absolutePath: string;
  relativePath: string;
  content: string;
};

type RuleContext = {
  files: ScannedFile[];
  findings: AuditFinding[];
  seenPaths: Set<string>;
};

type CategoryRule = {
  id: string;
  category: AuditCategory;
  severity: AuditSeverity;
  explanation: string;
  recommendation: string;
};

const DISCLAIMER =
  'Orientación preliminar y técnica basada en señales estáticas locales; no constituye certificación de seguridad ni dictamen jurídico.';

const DEFAULT_OPTIONS = {
  maxDepth: 6,
  maxFiles: 500,
  maxFileSizeBytes: 256 * 1024,
} satisfies Required<AuditOptions>;

const EXCLUDED_DIRECTORIES = new Set([
  '.git',
  '.hg',
  '.next',
  '.nuxt',
  '.svn',
  '.turbo',
  '.yarn',
  'bin',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'target',
  'tmp',
  'vendor',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.cjs',
  '.conf',
  '.config',
  '.css',
  '.env',
  '.html',
  '.ini',
  '.java',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.mts',
  '.php',
  '.properties',
  '.py',
  '.rb',
  '.sql',
  '.sh',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.vue',
  '.xml',
  '.yaml',
  '.yml',
]);

const ALLOWED_BASENAMES = new Set([
  '.env',
  '.env.example',
  '.env.local',
  'dockerfile',
  'license',
  'privacy',
  'readme',
]);

const CATEGORY_ORDER: AuditCategory[] = [
  'secretos',
  'datos_personales',
  'logs_sensibles',
  'transporte_inseguro',
  'cors',
  'cookies',
  'endpoints_sensibles',
  'documentacion',
];

const SEVERITY_ORDER: AuditSeverity[] = ['critical', 'high', 'medium', 'low'];

const REFERENCE_LIBRARY: Record<string, AuditReference> = {
  lopdp: {
    id: 'lopdp',
    title: 'Ley Orgánica de Protección de Datos Personales',
    url: 'https://www.registroficial.gob.ec/quinto-suplemento-al-registro-oficial-no-459/',
    verifiedAt: '2026-08-27',
    status: 'vigente',
    topic: 'datos personales',
    rationale: 'Base general para privacidad, seguridad y transparencia en el tratamiento de datos personales.',
  },
  'comercio-electronico': {
    id: 'comercio-electronico',
    title: 'Ley de Comercio Electrónico, Firmas Electrónicas y Mensajes de Datos',
    url: 'https://www.telecomunicaciones.gob.ec/wp-content/uploads/2020/07/LEY-DE-COMERCIO-ELECTRONICO-FIRMAS-Y.pdf',
    verifiedAt: '2026-08-27',
    status: 'reformado',
    topic: 'seguridad de servicios digitales',
    rationale: 'Referencia útil para controles de servicios digitales, contratación y manejo seguro de mensajes de datos.',
  },
};

const RULES: Record<string, CategoryRule> = {
  secret: {
    id: 'secret-exposed',
    category: 'secretos',
    severity: 'high',
    explanation: 'Se detectó un posible secreto o credencial incrustada en código o configuración.',
    recommendation: 'Mueva el valor a un gestor de secretos o variables de entorno, rote la credencial y elimine el valor del repositorio.',
  },
  personalData: {
    id: 'personal-data-signal',
    category: 'datos_personales',
    severity: 'medium',
    explanation: 'La línea contiene señales de tratamiento o exposición de datos personales que requieren base jurídica, transparencia y minimización.',
    recommendation: 'Documente finalidades, minimice campos, defina conservación y confirme medidas de seguridad y aviso de privacidad.',
  },
  sensitiveLog: {
    id: 'sensitive-log',
    category: 'logs_sensibles',
    severity: 'medium',
    explanation: 'Se detectó un log con referencias a datos o credenciales sensibles.',
    recommendation: 'Evite registrar datos personales o secretos; aplique filtrado y enmascaramiento antes de emitir logs.',
  },
  insecureHttp: {
    id: 'insecure-http',
    category: 'transporte_inseguro',
    severity: 'medium',
    explanation: 'Se detectó uso de HTTP inseguro para una URL que no parece local.',
    recommendation: 'Use HTTPS y valide la configuración de transporte seguro en servicios y dependencias externas.',
  },
  permissiveCors: {
    id: 'permissive-cors',
    category: 'cors',
    severity: 'medium',
    explanation: 'Se detectó una configuración CORS permisiva que puede exponer recursos a orígenes no previstos.',
    recommendation: 'Defina una allowlist explícita de orígenes y revise métodos, credenciales y cabeceras permitidas.',
  },
  insecureCookie: {
    id: 'insecure-cookie',
    category: 'cookies',
    severity: 'medium',
    explanation: 'Se detectó uso de cookies sin señales suficientes de atributos seguros.',
    recommendation: 'Aplique `Secure`, `HttpOnly` y `SameSite` según corresponda y documente el uso de cookies.',
  },
  sensitiveEndpoint: {
    id: 'sensitive-endpoint',
    category: 'endpoints_sensibles',
    severity: 'medium',
    explanation: 'Se detectó un endpoint sensible sin una señal clara de control de autenticación o autorización en la misma ruta.',
    recommendation: 'Exija autenticación, autorización y registro de acceso para endpoints administrativos o con datos sensibles.',
  },
  missingPrivacyDocs: {
    id: 'missing-privacy-docs',
    category: 'documentacion',
    severity: 'low',
    explanation: 'No se detectó documentación visible de privacidad, tratamiento de datos o retención en el repositorio.',
    recommendation: 'Agregue documentación de privacidad, retención, consentimiento e incidentes alineada con el tratamiento real.',
  },
};

const CONTROL_LIBRARY: Record<string, AuditControl> = {
  general: {
    id: 'control-revision-fuentes',
    category: 'general',
    title: 'Revisar fuentes oficiales y alcance de la auditoría',
    description: 'Validar vigencia normativa, alcance técnico y evidencias antes de concluir cumplimiento o seguridad.',
    referenceIds: ['lopdp', 'comercio-electronico'],
    status: 'pendiente',
  },
  secretos: {
    id: 'control-secretos',
    category: 'secretos',
    title: 'Gestionar secretos fuera del repositorio',
    description: 'Centralizar credenciales en variables de entorno o gestor de secretos, con rotación y revocación documentada.',
    referenceIds: ['lopdp'],
    status: 'pendiente',
  },
  datos_personales: {
    id: 'control-datos-personales',
    category: 'datos_personales',
    title: 'Inventariar tratamientos de datos personales',
    description: 'Documentar finalidades, categorías de datos, responsables, encargados, bases jurídicas y plazos de conservación.',
    referenceIds: ['lopdp'],
    status: 'pendiente',
  },
  logs_sensibles: {
    id: 'control-logs',
    category: 'logs_sensibles',
    title: 'Enmascarar logs sensibles',
    description: 'Restringir trazas con datos personales o credenciales y definir reglas de redacción y retención.',
    referenceIds: ['lopdp'],
    status: 'pendiente',
  },
  transporte_inseguro: {
    id: 'control-transporte',
    category: 'transporte_inseguro',
    title: 'Forzar transporte seguro',
    description: 'Asegurar HTTPS, validar certificados y eliminar integraciones que usen HTTP inseguro en producción.',
    referenceIds: ['lopdp', 'comercio-electronico'],
    status: 'pendiente',
  },
  cors: {
    id: 'control-cors',
    category: 'cors',
    title: 'Restringir CORS',
    description: 'Definir orígenes permitidos de forma explícita y revisar el uso de credenciales y cabeceras expuestas.',
    referenceIds: ['lopdp', 'comercio-electronico'],
    status: 'pendiente',
  },
  cookies: {
    id: 'control-cookies',
    category: 'cookies',
    title: 'Asegurar cookies y sesiones',
    description: 'Aplicar atributos `Secure`, `HttpOnly` y `SameSite`, y documentar finalidades y duración de las cookies.',
    referenceIds: ['lopdp', 'comercio-electronico'],
    status: 'pendiente',
  },
  endpoints_sensibles: {
    id: 'control-endpoints',
    category: 'endpoints_sensibles',
    title: 'Proteger endpoints sensibles',
    description: 'Aplicar autenticación, autorización y monitoreo sobre rutas administrativas, financieras o con datos personales.',
    referenceIds: ['lopdp', 'comercio-electronico'],
    status: 'pendiente',
  },
  documentacion: {
    id: 'control-documentacion',
    category: 'documentacion',
    title: 'Mantener documentación de privacidad',
    description: 'Conservar avisos, políticas y procedimientos de privacidad, retención, consentimiento e incidentes.',
    referenceIds: ['lopdp'],
    status: 'pendiente',
  },
};

const PERSONAL_DATA_TERMS =
  '(?:email|correo|telefono|phone|celular|cedula|dni|passport|pasaporte|direccion|address|fecha[_ -]?nacimiento|birthdate|personal[_ -]?data|datos?[_ -]?personales?)';
const PERSONAL_DATA_QUOTED_KEY_PATTERN = new RegExp(
  String.raw`['"\`]\s*${PERSONAL_DATA_TERMS}\s*['"\`]\s*[:=]`,
  'i',
);
const PERSONAL_DATA_BRACKET_ACCESS_PATTERN = new RegExp(
  String.raw`\[\s*['"\`]\s*${PERSONAL_DATA_TERMS}\s*['"\`]\s*\]`,
  'i',
);
const PERSONAL_DATA_CODE_SIGNAL_PATTERN = new RegExp(
  String.raw`(?:\b${PERSONAL_DATA_TERMS}\b\s*[:=])|(?:\.\s*\b${PERSONAL_DATA_TERMS}\b)|(?:\[\s*\b${PERSONAL_DATA_TERMS}\b\s*\])`,
  'i',
);
const SENSITIVE_LOG_PATTERN =
  /\b(console\.(log|info|debug|warn|error)|logger\.(info|debug|warn|error)|print)\b/i;
const SENSITIVE_HINT_PATTERN =
  /\b(password|token|secret|api[_-]?key|cookie|session|email|correo|cedula|dni|telefono|phone)\b/i;
const PERMISSIVE_CORS_PATTERN =
  /(access-control-allow-origin\s*[:=]\s*['"`]\*['"`]|origin\s*:\s*['"`]\*['"`]|cors\s*\(\s*\)|cors\s*\(\s*\{\s*origin\s*:\s*['"`]\*['"`])/i;
const SENSITIVE_ENDPOINT_PATTERN =
  /\b(app|router)\.(get|post|put|patch|delete)\s*\(\s*['"`]\/(admin|auth|login|users|user|account|profile|payments?|checkout|orders?)\b/i;
const AUTH_HINT_PATTERN = /\b(auth|authorize|jwt|session|guard|protect|middleware|verify)\b/i;
const COOKIE_PATTERN = /\b(res\.cookie|set-cookie|document\.cookie)\b/i;
const SECURE_COOKIE_HINT_PATTERN = /\b(secure|httponly|samesite)\b/i;
const HTTP_URL_PATTERN = /\bhttp:\/\/(?!localhost\b)(?!127\.0\.0\.1\b)(?!0\.0\.0\.0\b)[^\s'"`]+/i;

export async function auditRepository(repositoryPath: string, options: AuditOptions = {}): Promise<AuditReport> {
  const resolvedOptions = normalizeOptions(options);
  const rootPath = resolve(repositoryPath);
  const rootStats = await stat(rootPath).catch(() => {
    throw new Error(`Ruta de repositorio inválida: ${repositoryPath}`);
  });

  if (!rootStats.isDirectory()) {
    throw new Error(`La ruta no es un directorio: ${repositoryPath}`);
  }

  const rootRealPath = await realpath(rootPath);
  const scanState = {
    files: [] as ScannedFile[],
    scannedDirectories: 0,
    skippedEntries: 0,
  };

  await walkDirectory(rootRealPath, rootRealPath, 0, resolvedOptions, scanState);

  const findings: AuditFinding[] = [];
  const ruleContext: RuleContext = {
    files: scanState.files,
    findings,
    seenPaths: new Set(scanState.files.map((file) => file.relativePath)),
  };

  for (const file of scanState.files) {
    analyzeFile(file, findings);
  }
  applyRepositoryRules(ruleContext);

  const sortedFindings = [...findings].sort(compareFindings);
  const references = collectReferences(sortedFindings);
  const controls = collectControls(sortedFindings);

  return {
    summary: buildSummary(rootPath, rootRealPath, resolvedOptions, scanState, sortedFindings),
    findings: sortedFindings,
    controls,
    references,
    disclaimer: DISCLAIMER,
  };
}

async function walkDirectory(
  rootRealPath: string,
  directoryPath: string,
  depth: number,
  options: Required<AuditOptions>,
  state: { files: ScannedFile[]; scannedDirectories: number; skippedEntries: number },
): Promise<void> {
  if (depth > options.maxDepth || state.files.length >= options.maxFiles) {
    return;
  }

  state.scannedDirectories += 1;
  const entries = await readdir(directoryPath, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));

  for (const entry of entries) {
    if (state.files.length >= options.maxFiles) {
      state.skippedEntries += 1;
      continue;
    }

    const entryPath = resolve(directoryPath, entry.name);
    const entryStats = await lstat(entryPath);

    if (entryStats.isSymbolicLink()) {
      state.skippedEntries += 1;
      continue;
    }

    const entryRealPath = await realpath(entryPath);
    if (!isWithinRoot(rootRealPath, entryRealPath)) {
      state.skippedEntries += 1;
      continue;
    }

    if (entryStats.isDirectory()) {
      if (EXCLUDED_DIRECTORIES.has(entry.name.toLowerCase())) {
        state.skippedEntries += 1;
        continue;
      }
      if (depth >= options.maxDepth) {
        state.skippedEntries += 1;
        continue;
      }
      await walkDirectory(rootRealPath, entryRealPath, depth + 1, options, state);
      continue;
    }

    if (!entryStats.isFile()) {
      state.skippedEntries += 1;
      continue;
    }

    if (!isAllowedTextFile(entry.name)) {
      state.skippedEntries += 1;
      continue;
    }

    if (entryStats.size > options.maxFileSizeBytes) {
      state.skippedEntries += 1;
      continue;
    }

    const content = await readFile(entryRealPath, 'utf8');
    if (looksBinary(content)) {
      state.skippedEntries += 1;
      continue;
    }

    state.files.push({
      absolutePath: entryRealPath,
      relativePath: toRelativePath(rootRealPath, entryRealPath),
      content,
    });
  }
}

function analyzeFile(file: ScannedFile, findings: AuditFinding[]) {
  const lines = file.content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    const secretValue = findSecretValue(line);
    if (secretValue) {
      findings.push(
        buildFinding(file.relativePath, lineNumber, RULES.secret, redactSecretLine(line, secretValue), referenceForCategory('secretos')),
      );
    }

    if (hasPersonalDataSignal(line)) {
      findings.push(buildFinding(file.relativePath, lineNumber, RULES.personalData, shorten(line), referenceForCategory('datos_personales')));
    }

    if (SENSITIVE_LOG_PATTERN.test(line) && SENSITIVE_HINT_PATTERN.test(line)) {
      findings.push(buildFinding(file.relativePath, lineNumber, RULES.sensitiveLog, shorten(redactSecretLine(line)), referenceForCategory('logs_sensibles')));
    }

    if (HTTP_URL_PATTERN.test(line)) {
      findings.push(buildFinding(file.relativePath, lineNumber, RULES.insecureHttp, shorten(line), referenceForCategory('transporte_inseguro')));
    }

    if (PERMISSIVE_CORS_PATTERN.test(line)) {
      findings.push(buildFinding(file.relativePath, lineNumber, RULES.permissiveCors, shorten(line), referenceForCategory('cors')));
    }

    if (COOKIE_PATTERN.test(line) && !SECURE_COOKIE_HINT_PATTERN.test(line)) {
      findings.push(buildFinding(file.relativePath, lineNumber, RULES.insecureCookie, shorten(redactSecretLine(line)), referenceForCategory('cookies')));
    }

    if (SENSITIVE_ENDPOINT_PATTERN.test(line) && !AUTH_HINT_PATTERN.test(line)) {
      findings.push(buildFinding(file.relativePath, lineNumber, RULES.sensitiveEndpoint, shorten(line), referenceForCategory('endpoints_sensibles')));
    }
  });
}

function applyRepositoryRules(context: RuleContext) {
  const hasPrivacyDocumentation = context.files.some((file) => {
    const lowerPath = file.relativePath.toLowerCase();
    return (
      lowerPath.includes('privacy') ||
      lowerPath.includes('privacidad') ||
      lowerPath.includes('datos-personales') ||
      lowerPath.includes('data-protection')
    );
  });

  if (!hasPrivacyDocumentation) {
    context.findings.push({
      id: `${RULES.missingPrivacyDocs.id}:repository`,
      ruleId: RULES.missingPrivacyDocs.id,
      severity: RULES.missingPrivacyDocs.severity,
      category: RULES.missingPrivacyDocs.category,
      path: '.',
      explanation: RULES.missingPrivacyDocs.explanation,
      evidence: 'No se encontró un archivo visible de privacidad o tratamiento de datos dentro del repositorio escaneado.',
      recommendation: RULES.missingPrivacyDocs.recommendation,
      reference: referenceForCategory('documentacion'),
      status: 'pendiente',
    });
  }
}

function buildFinding(
  relativePath: string,
  line: number,
  rule: CategoryRule,
  evidence: string,
  reference: AuditReference,
): AuditFinding {
  return {
    id: `${rule.id}:${relativePath}:${line}`,
    ruleId: rule.id,
    severity: rule.severity,
    category: rule.category,
    path: relativePath,
    line,
    explanation: rule.explanation,
    evidence,
    recommendation: rule.recommendation,
    reference,
    status: 'pendiente',
  };
}

function buildSummary(
  rootPath: string,
  rootRealPath: string,
  options: Required<AuditOptions>,
  state: { files: ScannedFile[]; scannedDirectories: number; skippedEntries: number },
  findings: AuditFinding[],
): AuditSummary {
  const findingsBySeverity = Object.fromEntries(SEVERITY_ORDER.map((severity) => [severity, 0])) as Record<AuditSeverity, number>;
  const findingsByCategory = Object.fromEntries(CATEGORY_ORDER.map((category) => [category, 0])) as Record<AuditCategory, number>;

  for (const finding of findings) {
    findingsBySeverity[finding.severity] += 1;
    findingsByCategory[finding.category] += 1;
  }

  return {
    repository: basename(rootPath),
    rootPath: rootRealPath,
    generatedAt: new Date().toISOString(),
    scannedFiles: state.files.length,
    scannedDirectories: state.scannedDirectories,
    skippedEntries: state.skippedEntries,
    totalFindings: findings.length,
    findingsBySeverity,
    findingsByCategory,
    limits: {
      maxDepth: options.maxDepth,
      maxFiles: options.maxFiles,
      maxFileSizeBytes: options.maxFileSizeBytes,
    },
  };
}

function collectReferences(findings: AuditFinding[]): AuditReference[] {
  const references = new Map<string, AuditReference>();
  for (const finding of findings) {
    references.set(finding.reference.id, finding.reference);
  }
  if (references.size === 0) {
    references.set(REFERENCE_LIBRARY.lopdp.id, REFERENCE_LIBRARY.lopdp);
  }
  return [...references.values()].sort((left, right) => left.id.localeCompare(right.id, 'en'));
}

function collectControls(findings: AuditFinding[]): AuditControl[] {
  const controls = new Map<string, AuditControl>();
  controls.set(CONTROL_LIBRARY.general.id, CONTROL_LIBRARY.general);

  for (const finding of findings) {
    const control = CONTROL_LIBRARY[finding.category];
    if (control) {
      controls.set(control.id, control);
    }
  }

  return [...controls.values()].sort((left, right) => left.id.localeCompare(right.id, 'en'));
}

function compareFindings(left: AuditFinding, right: AuditFinding): number {
  const severityDelta = SEVERITY_ORDER.indexOf(left.severity) - SEVERITY_ORDER.indexOf(right.severity);
  if (severityDelta !== 0) {
    return severityDelta;
  }
  const pathDelta = left.path.localeCompare(right.path, 'en');
  if (pathDelta !== 0) {
    return pathDelta;
  }
  const lineDelta = (left.line ?? 0) - (right.line ?? 0);
  if (lineDelta !== 0) {
    return lineDelta;
  }
  return left.ruleId.localeCompare(right.ruleId, 'en');
}

function normalizeOptions(options: AuditOptions): Required<AuditOptions> {
  return {
    maxDepth: normalizePositiveInteger(options.maxDepth, DEFAULT_OPTIONS.maxDepth, 'maxDepth'),
    maxFiles: normalizePositiveInteger(options.maxFiles, DEFAULT_OPTIONS.maxFiles, 'maxFiles'),
    maxFileSizeBytes: normalizePositiveInteger(options.maxFileSizeBytes, DEFAULT_OPTIONS.maxFileSizeBytes, 'maxFileSizeBytes'),
  };
}

function normalizePositiveInteger(value: number | undefined, fallback: number, name: string) {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`La opción ${name} debe ser un entero positivo`);
  }
  return value;
}

function isAllowedTextFile(fileName: string): boolean {
  const lowerBase = basename(fileName).toLowerCase();
  const extension = extname(fileName).toLowerCase();

  if (ALLOWED_EXTENSIONS.has(extension)) {
    return true;
  }
  if (ALLOWED_BASENAMES.has(lowerBase)) {
    return true;
  }
  return lowerBase.startsWith('.env');
}

function looksBinary(content: string): boolean {
  return content.includes('\u0000');
}

function findSecretValue(line: string): string | null {
  const directPatterns = [
    /sk_(?:live|test)_[A-Za-z0-9]{8,}/,
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN [A-Z ]+ PRIVATE KEY-----/,
  ];

  for (const pattern of directPatterns) {
    const match = line.match(pattern);
    if (match?.[0]) {
      return match[0];
    }
  }

  const assignmentMatch = line.match(
    /\b(api[_-]?key|secret|token|password|passwd|client[_-]?secret)\b\s*[:=]\s*['"`]?([A-Za-z0-9._/+\\=-]{8,})['"`]?/i,
  );
  return assignmentMatch?.[2] ?? null;
}

function redactSecretLine(line: string, explicitSecret?: string): string {
  let redacted = line;
  if (explicitSecret) {
    redacted = redacted.split(explicitSecret).join('[REDACTED]');
  }

  const genericPatterns = [
    /sk_(?:live|test)_[A-Za-z0-9]{8,}/g,
    /AKIA[0-9A-Z]{16}/g,
    /-----BEGIN [A-Z ]+ PRIVATE KEY-----/g,
    /(\b(api[_-]?key|secret|token|password|passwd|client[_-]?secret)\b\s*[:=]\s*['"`]?)([A-Za-z0-9._/+\\=-]{8,})(['"`]?)/gi,
  ];

  for (const pattern of genericPatterns) {
    redacted = redacted.replace(pattern, (...parts: string[]) => {
      if (parts.length >= 5 && typeof parts[1] === 'string' && typeof parts[3] === 'string' && typeof parts[4] === 'string') {
        return `${parts[1]}[REDACTED]${parts[4]}`;
      }
      return '[REDACTED]';
    });
  }

  return shorten(redacted);
}

function hasPersonalDataSignal(line: string): boolean {
  if (!line || isDocumentationLikeLine(line)) {
    return false;
  }
  if (!/(?:\b|['"\`])(?:email|correo|telefono|phone|celular|cedula|dni|passport|pasaporte|direccion|address|fecha[_ -]?nacimiento|birthdate|personal[_ -]?data|datos?[_ -]?personales?)(?:\b|['"\`])/i.test(line)) {
    return false;
  }

  if (PERSONAL_DATA_QUOTED_KEY_PATTERN.test(line) || PERSONAL_DATA_BRACKET_ACCESS_PATTERN.test(line)) {
    return true;
  }

  const structuralLine = stripLiteralContent(line);
  return PERSONAL_DATA_CODE_SIGNAL_PATTERN.test(structuralLine);
}

function isDocumentationLikeLine(line: string): boolean {
  const trimmed = line.trimStart();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('<!--') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('>') ||
    trimmed.startsWith('- ') ||
    trimmed.startsWith('* ') ||
    trimmed.startsWith('|')
  );
}

function stripLiteralContent(line: string): string {
  return line
    .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '')
    .replace(/\/(?![/*])(?:\\.|[^/\\\n])+\/[gimsuy]*/g, '');
}

function referenceForCategory(category: AuditCategory): AuditReference {
  if (category === 'transporte_inseguro' || category === 'cors' || category === 'cookies' || category === 'endpoints_sensibles') {
    return REFERENCE_LIBRARY['comercio-electronico'];
  }
  return REFERENCE_LIBRARY.lopdp;
}

function shorten(line: string, maxLength = 220): string {
  const trimmed = line.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 3)}...`;
}

function isWithinRoot(rootRealPath: string, candidateRealPath: string): boolean {
  const rel = relative(rootRealPath, candidateRealPath);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function toRelativePath(rootRealPath: string, candidateRealPath: string): string {
  return relative(rootRealPath, candidateRealPath).split('\\').join('/');
}
