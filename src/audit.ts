import { lstat, readdir, readFile, realpath, stat } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import type { LegalSource, LegalStatus } from './domain.js';
import { detectLanguage, isScannableTextFile, type DetectedLanguage, type LanguageFamily } from './languages.js';
import { loadAuditConfig, type AuditConfig } from './config.js';

export type AuditSeverity = 'critical' | 'high' | 'medium' | 'low';
export type AuditCategory =
  | 'secretos'
  | 'datos_personales'
  | 'logs_sensibles'
  | 'transporte_inseguro'
  | 'cors'
  | 'cookies'
  | 'endpoints_sensibles'
  | 'infraestructura'
  | 'documentacion';
export type AuditStatus = 'cumple' | 'no cumple' | 'no aplica' | 'pendiente';

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
  language: DetectedLanguage;
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
  languages: Partial<Record<DetectedLanguage, number>>;
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
  language: DetectedLanguage;
  family: LanguageFamily;
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

const CATEGORY_ORDER: AuditCategory[] = [
  'secretos',
  'datos_personales',
  'logs_sensibles',
  'transporte_inseguro',
  'cors',
  'cookies',
  'endpoints_sensibles',
  'infraestructura',
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
  dockerRootUser: {
    id: 'docker-root-user',
    category: 'infraestructura',
    severity: 'high',
    explanation: 'El contenedor no declara un usuario no privilegiado y puede ejecutarse como root.',
    recommendation: 'Defina `USER` con una cuenta no privilegiada y verifique permisos mínimos para archivos y procesos.',
  },
  dockerFloatingImage: {
    id: 'docker-floating-image',
    category: 'infraestructura',
    severity: 'medium',
    explanation: 'La imagen base de Docker usa una referencia flotante o sin versión fija.',
    recommendation: 'Fije la imagen base con una versión concreta o digest para reducir deriva y riesgo de cadena de suministro.',
  },
  dockerExposedPort: {
    id: 'docker-exposed-port',
    category: 'infraestructura',
    severity: 'medium',
    explanation: 'El contenedor expone un puerto sensible que suele requerir controles de red adicionales.',
    recommendation: 'Evite exponer puertos administrativos o de bases de datos; restrínjalos por red privada o proxy autenticado.',
  },
  githubActionsSecretExposure: {
    id: 'github-actions-secret-exposure',
    category: 'infraestructura',
    severity: 'high',
    explanation: 'El workflow de GitHub Actions parece volcar un secreto en un comando con salida visible.',
    recommendation: 'No imprima secretos en pasos `run`; páselos por variables de entorno estrictamente necesarias y use enmascaramiento.',
  },
  terraformPublicResource: {
    id: 'terraform-public-resource',
    category: 'infraestructura',
    severity: 'high',
    explanation: 'Terraform declara una exposición pública amplia o un recurso marcado como accesible públicamente.',
    recommendation: 'Restrinja CIDR, deshabilite acceso público por defecto y documente las excepciones con controles compensatorios.',
  },
  terraformMissingEncryption: {
    id: 'terraform-missing-encryption',
    category: 'infraestructura',
    severity: 'high',
    explanation: 'Terraform deshabilita explícitamente cifrado en reposo para un recurso de infraestructura.',
    recommendation: 'Habilite cifrado en reposo y gestione claves con un servicio KMS o mecanismo equivalente.',
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
  infraestructura: {
    id: 'control-infraestructura',
    category: 'infraestructura',
    title: 'Fortalecer infraestructura y CI/CD',
    description: 'Reducir exposición pública, evitar ejecución privilegiada y proteger secretos y cifrado en definiciones de infraestructura.',
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
const EXTENDED_LOG_PATTERN = /\b(System\.out\.print(?:ln)?|printf|echo|Write-(Host|Output))\b/i;
const SENSITIVE_HINT_PATTERN =
  /\b(password|token|secret|api[_-]?key|cookie|session|email|correo|cedula|dni|telefono|phone)\b/i;
const PERMISSIVE_CORS_PATTERN =
  /(access-control-allow-origin\s*[:=]\s*['"`]\*['"`]|origin\s*:\s*['"`]\*['"`]|cors\s*\(\s*\)|cors\s*\(\s*\{\s*origin\s*:\s*['"`]\*['"`])/i;
const SENSITIVE_ENDPOINT_PATTERN =
  /\b(app|router)\.(get|post|put|patch|delete)\s*\(\s*['"`]\/(admin|auth|login|users|user|account|profile|payments?|checkout|orders?)\b/i;
const LANGUAGE_ENDPOINT_PATTERNS = [
  /@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping|RequestMapping)\s*\(\s*['"`]\/(admin|auth|login|users?|account|profile|payments?|checkout|orders?)\b/i,
  /@(app|router)\.(get|post|put|patch|delete)\s*\(\s*['"`]\/(admin|auth|login|users?|account|profile|payments?|checkout|orders?)\b/i,
  /\bMap(Get|Post|Put|Patch|Delete)\s*\(\s*['"`]\/(admin|auth|login|users?|account|profile|payments?|checkout|orders?)\b/i,
  /\b(HandleFunc|route|Route|GET|POST|PUT|PATCH|DELETE)\s*\(\s*['"`]\/(admin|auth|login|users?|account|profile|payments?|checkout|orders?)\b/i,
  /\b(get|post|put|patch|delete)\s+['"`]\/(admin|auth|login|users?|account|profile|payments?|checkout|orders?)\b/i,
];
const AUTH_HINT_PATTERN = /\b(auth|authorize|jwt|session|guard|protect|middleware|verify)\b/i;
const COOKIE_PATTERN = /\b(res\.cookie|set-cookie|document\.cookie)\b/i;
const SECURE_COOKIE_HINT_PATTERN = /\b(secure|httponly|samesite)\b/i;
const HTTP_URL_PATTERN = /\bhttp:\/\/(?!localhost\b)(?!127\.0\.0\.1\b)(?!0\.0\.0\.0\b)[^\s'"`]+/i;
const INSECURE_COOKIE_CONFIG_PATTERN =
  /\b(cookie|session)\b.*\b(secure|httponly|http_only|samesite|same_site)\b\s*[:=]\s*(false|0|off|no|none)\b/i;
const INSECURE_TRANSPORT_PATTERNS = [
  /\brejectUnauthorized\s*:\s*false\b/i,
  /\bNODE_TLS_REJECT_UNAUTHORIZED\s*=\s*0\b/i,
  /\bverify\s*[:=]\s*false\b/i,
  /\bverify_ssl\s*[:=]\s*false\b/i,
  /\bsslmode\s*=\s*disable\b/i,
  /\binsecure_skip_verify\s*[:=]\s*true\b/i,
  /\bInsecureSkipVerify\s*:\s*true\b/i,
  /\bdanger_accept_invalid_certs\s*\(\s*true\s*\)/i,
  /\bvalidate_certs\s*[:=]\s*false\b/i,
  /\bprotocol\s*[:=]\s*['"`]http['"`]/i,
  /\binsecure\s*[:=]\s*true\b/i,
];
const LANGUAGE_CORS_PATTERNS = [
  /\ballow_origins\s*[:=]\s*\[[^\]]*['"`]\*['"`]/i,
  /@CrossOrigin\s*\(\s*origins?\s*=\s*['"`]\*['"`]/i,
  /\b(AllowAnyOrigin|WithOrigins)\s*\(\s*['"`]\*['"`]?\s*\)/i,
  /\bheaders\s*\[\s*['"`]Access-Control-Allow-Origin['"`]\s*\]\s*=\s*['"`]\*['"`]/i,
  /\baccess[-_ ]control[-_ ]allow[-_ ]origin\b\s*[:=]\s*['"`]?\*['"`]?/i,
];
const GITHUB_ACTIONS_WORKFLOW_PATTERN = /^\.github\/workflows\/.+\.(yaml|yml)$/i;
const DOCKER_SENSITIVE_PORTS = new Set(['22', '2375', '2376', '3306', '5432', '6379', '9200', '11211', '27017']);
const TERRAFORM_PUBLIC_PATTERNS = [/\b0\.0\.0\.0\/0\b/i, /\b::\/0\b/i, /\bpublicly_accessible\s*=\s*true\b/i, /\bpublic\s*=\s*true\b/i, /\bmap_public_ip_on_launch\s*=\s*true\b/i];
const TERRAFORM_UNENCRYPTED_PATTERNS = [
  /\bstorage_encrypted\s*=\s*false\b/i,
  /\bencrypted\s*=\s*false\b/i,
  /\benable_at_rest_encryption\s*=\s*false\b/i,
  /\bserver_side_encryption_configuration\s*=\s*false\b/i,
];
const CONFIG_FAMILIES = new Set<LanguageFamily>(['config', 'docker', 'terraform']);
const LOG_FAMILIES = new Set<LanguageFamily>(['javascript', 'python', 'jvm', 'dotnet', 'go', 'rust', 'ruby', 'c-cpp', 'shell']);

export async function auditRepository(repositoryPath: string, options: AuditOptions = {}): Promise<AuditReport> {
  const rootPath = resolve(repositoryPath);
  const rootStats = await stat(rootPath).catch(() => {
    throw new Error(`Ruta de repositorio inválida: ${repositoryPath}`);
  });

  if (!rootStats.isDirectory()) {
    throw new Error(`La ruta no es un directorio: ${repositoryPath}`);
  }

  const rootRealPath = await realpath(rootPath);
  const loadedConfig = await loadAuditConfig(rootRealPath);
  const resolvedOptions = normalizeOptions(options, loadedConfig.config.limits);
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
    analyzeFile(file, findings, loadedConfig.config);
  }
  applyRepositoryRules(ruleContext, loadedConfig.config);

  const sortedFindings = [...findings].sort(compareFindings);
  const references = collectReferences(sortedFindings);
  const controls = collectControls(sortedFindings, loadedConfig.config);

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

    if (!isScannableTextFile(entry.name)) {
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

    const relativePath = toRelativePath(rootRealPath, entryRealPath);
    const { language, family } = detectLanguage(relativePath);

    state.files.push({
      absolutePath: entryRealPath,
      relativePath,
      language,
      family,
      content,
    });
  }
}

function analyzeFile(file: ScannedFile, findings: AuditFinding[], config: AuditConfig) {
  const lines = file.content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    const secretValue = findSecretValue(line);
    if (secretValue) {
      findings.push(
        buildFinding(file, lineNumber, RULES.secret, redactSecretLine(line, secretValue), referenceForCategory('secretos'), config),
      );
    }

    if (hasPersonalDataSignal(line)) {
      findings.push(buildFinding(file, lineNumber, RULES.personalData, shorten(line), referenceForCategory('datos_personales'), config));
    }

    if (matchesSensitiveLog(file, line)) {
      findings.push(
        buildFinding(file, lineNumber, RULES.sensitiveLog, shorten(redactSecretLine(line)), referenceForCategory('logs_sensibles'), config),
      );
    }

    if (matchesInsecureTransport(file, line)) {
      findings.push(
        buildFinding(file, lineNumber, RULES.insecureHttp, shorten(line), referenceForCategory('transporte_inseguro'), config),
      );
    }

    if (matchesPermissiveCors(file, line)) {
      findings.push(buildFinding(file, lineNumber, RULES.permissiveCors, shorten(line), referenceForCategory('cors'), config));
    }

    if (matchesInsecureCookie(file, line)) {
      findings.push(buildFinding(file, lineNumber, RULES.insecureCookie, shorten(redactSecretLine(line)), referenceForCategory('cookies'), config));
    }

    if (matchesSensitiveEndpoint(file, line)) {
      findings.push(
        buildFinding(file, lineNumber, RULES.sensitiveEndpoint, shorten(line), referenceForCategory('endpoints_sensibles'), config),
      );
    }
  });
}

function applyRepositoryRules(context: RuleContext, config: AuditConfig) {
  applyInfrastructureRules(context, config);

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
      language: 'unknown',
      path: '.',
      explanation: RULES.missingPrivacyDocs.explanation,
      evidence: 'No se encontró un archivo visible de privacidad o tratamiento de datos dentro del repositorio escaneado.',
      recommendation: RULES.missingPrivacyDocs.recommendation,
      reference: referenceForCategory('documentacion'),
      status: resolveFindingStatus(config, {
        id: `${RULES.missingPrivacyDocs.id}:repository`,
        ruleId: RULES.missingPrivacyDocs.id,
        category: RULES.missingPrivacyDocs.category,
      }),
    });
  }
}

function applyInfrastructureRules(context: RuleContext, config: AuditConfig) {
  for (const file of context.files) {
    if (file.family === 'docker') {
      applyDockerRules(file, context.findings, config);
      continue;
    }

    if (file.family === 'terraform') {
      applyTerraformRules(file, context.findings, config);
      continue;
    }

    if (isGitHubActionsWorkflow(file)) {
      applyGitHubActionsRules(file, context.findings, config);
    }
  }
}

function applyDockerRules(file: ScannedFile, findings: AuditFinding[], config: AuditConfig) {
  const lines = file.content.split(/\r?\n/);
  const fromLine = lines.findIndex((line) => /^\s*FROM\b/i.test(line));

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (isFloatingDockerImage(line)) {
      findings.push(
        buildFinding(file, index + 1, RULES.dockerFloatingImage, shorten(line), referenceForCategory('infraestructura'), config),
      );
    }

    const exposedPort = extractSensitiveDockerPort(line);
    if (exposedPort) {
      findings.push(
        buildFinding(
          file,
          index + 1,
          RULES.dockerExposedPort,
          shorten(`EXPOSE ${exposedPort}`),
          referenceForCategory('infraestructura'),
          config,
        ),
      );
    }
  }

  if (fromLine >= 0 && !hasExplicitNonRootUser(lines)) {
    findings.push(
      buildRepositoryFinding(
        file,
        RULES.dockerRootUser,
        'No se detectó una instrucción USER no privilegiada en el Dockerfile.',
        referenceForCategory('infraestructura'),
        config,
        fromLine + 1,
      ),
    );
  }
}

function applyGitHubActionsRules(file: ScannedFile, findings: AuditFinding[], config: AuditConfig) {
  const lines = file.content.split(/\r?\n/);
  let runBlockIndent: number | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;

    if (runBlockIndent !== null) {
      if (trimmed.length === 0) {
        continue;
      }
      if (indent <= runBlockIndent) {
        runBlockIndent = null;
      } else if (isSecretEchoCommand(trimmed)) {
        findings.push(
          buildFinding(
            file,
            index + 1,
            RULES.githubActionsSecretExposure,
            shorten(trimmed),
            referenceForCategory('infraestructura'),
            config,
          ),
        );
        runBlockIndent = null;
        continue;
      } else {
        continue;
      }
    }

    if (!/\brun\s*:/i.test(trimmed)) {
      continue;
    }

    if (isSecretEchoCommand(trimmed)) {
      findings.push(
        buildFinding(file, index + 1, RULES.githubActionsSecretExposure, shorten(trimmed), referenceForCategory('infraestructura'), config),
      );
      continue;
    }

    if (/^\s*-\s*run\s*:\s*[>|]?\s*$/i.test(line) || /^\s*run\s*:\s*[>|]?\s*$/i.test(line)) {
      runBlockIndent = indent;
    }
  }
}

function applyTerraformRules(file: ScannedFile, findings: AuditFinding[], config: AuditConfig) {
  const lines = file.content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (TERRAFORM_PUBLIC_PATTERNS.some((pattern) => pattern.test(line))) {
      findings.push(
        buildFinding(file, index + 1, RULES.terraformPublicResource, shorten(line), referenceForCategory('infraestructura'), config),
      );
    }

    if (TERRAFORM_UNENCRYPTED_PATTERNS.some((pattern) => pattern.test(line))) {
      findings.push(
        buildFinding(file, index + 1, RULES.terraformMissingEncryption, shorten(line), referenceForCategory('infraestructura'), config),
      );
    }
  }
}

function buildRepositoryFinding(
  file: Pick<ScannedFile, 'relativePath' | 'language'>,
  rule: CategoryRule,
  evidence: string,
  reference: AuditReference,
  config: AuditConfig,
  line?: number,
): AuditFinding {
  return {
    id: `${rule.id}:${file.relativePath}${line ? `:${line}` : ''}`,
    ruleId: rule.id,
    severity: rule.severity,
    category: rule.category,
    language: file.language,
    path: file.relativePath,
    line,
    explanation: rule.explanation,
    evidence,
    recommendation: rule.recommendation,
    reference,
    status: resolveFindingStatus(config, {
      id: `${rule.id}:${file.relativePath}${line ? `:${line}` : ''}`,
      ruleId: rule.id,
      category: rule.category,
    }),
  };
}

function buildFinding(
  file: Pick<ScannedFile, 'relativePath' | 'language'>,
  line: number,
  rule: CategoryRule,
  evidence: string,
  reference: AuditReference,
  config: AuditConfig,
): AuditFinding {
  return {
    id: `${rule.id}:${file.relativePath}:${line}`,
    ruleId: rule.id,
    severity: rule.severity,
    category: rule.category,
    language: file.language,
    path: file.relativePath,
    line,
    explanation: rule.explanation,
    evidence,
    recommendation: rule.recommendation,
    reference,
    status: resolveFindingStatus(config, {
      id: `${rule.id}:${file.relativePath}:${line}`,
      ruleId: rule.id,
      category: rule.category,
    }),
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
  const languages: Partial<Record<DetectedLanguage, number>> = {};

  for (const finding of findings) {
    findingsBySeverity[finding.severity] += 1;
    findingsByCategory[finding.category] += 1;
  }

  for (const file of state.files) {
    languages[file.language] = (languages[file.language] ?? 0) + 1;
  }

  return {
    repository: basename(rootPath),
    rootPath: rootRealPath,
    generatedAt: new Date().toISOString(),
    scannedFiles: state.files.length,
    scannedDirectories: state.scannedDirectories,
    skippedEntries: state.skippedEntries,
    totalFindings: findings.length,
    languages,
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

function collectControls(findings: AuditFinding[], config: AuditConfig): AuditControl[] {
  const controls = new Map<string, AuditControl>();
  controls.set(CONTROL_LIBRARY.general.id, withControlStatus(CONTROL_LIBRARY.general, config));

  for (const finding of findings) {
    const control = CONTROL_LIBRARY[finding.category];
    if (control) {
      controls.set(control.id, withControlStatus(control, config));
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

function normalizeOptions(options: AuditOptions, configLimits: Partial<AuditOptions> = {}): Required<AuditOptions> {
  return {
    maxDepth: normalizePositiveInteger(options.maxDepth ?? configLimits.maxDepth, DEFAULT_OPTIONS.maxDepth, 'maxDepth'),
    maxFiles: normalizePositiveInteger(options.maxFiles ?? configLimits.maxFiles, DEFAULT_OPTIONS.maxFiles, 'maxFiles'),
    maxFileSizeBytes: normalizePositiveInteger(
      options.maxFileSizeBytes ?? configLimits.maxFileSizeBytes,
      DEFAULT_OPTIONS.maxFileSizeBytes,
      'maxFileSizeBytes',
    ),
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

function matchesSensitiveLog(file: ScannedFile, line: string): boolean {
  if (!SENSITIVE_HINT_PATTERN.test(line)) {
    return false;
  }
  return SENSITIVE_LOG_PATTERN.test(line) || (LOG_FAMILIES.has(file.family) && EXTENDED_LOG_PATTERN.test(line));
}

function matchesInsecureTransport(file: ScannedFile, line: string): boolean {
  if (HTTP_URL_PATTERN.test(line)) {
    return true;
  }
  if (CONFIG_FAMILIES.has(file.family)) {
    return INSECURE_TRANSPORT_PATTERNS.some((pattern) => pattern.test(line));
  }
  return INSECURE_TRANSPORT_PATTERNS.some((pattern) => pattern.test(line));
}

function matchesPermissiveCors(_file: ScannedFile, line: string): boolean {
  return PERMISSIVE_CORS_PATTERN.test(line) || LANGUAGE_CORS_PATTERNS.some((pattern) => pattern.test(line));
}

function matchesInsecureCookie(file: ScannedFile, line: string): boolean {
  if (COOKIE_PATTERN.test(line) && !SECURE_COOKIE_HINT_PATTERN.test(line)) {
    return true;
  }
  return CONFIG_FAMILIES.has(file.family) && INSECURE_COOKIE_CONFIG_PATTERN.test(line);
}

function matchesSensitiveEndpoint(_file: ScannedFile, line: string): boolean {
  if (AUTH_HINT_PATTERN.test(line)) {
    return false;
  }
  if (SENSITIVE_ENDPOINT_PATTERN.test(line)) {
    return true;
  }
  return LANGUAGE_ENDPOINT_PATTERNS.some((pattern) => pattern.test(line));
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
  if (
    category === 'transporte_inseguro' ||
    category === 'cors' ||
    category === 'cookies' ||
    category === 'endpoints_sensibles' ||
    category === 'infraestructura'
  ) {
    return REFERENCE_LIBRARY['comercio-electronico'];
  }
  return REFERENCE_LIBRARY.lopdp;
}

function isGitHubActionsWorkflow(file: ScannedFile): boolean {
  return file.language === 'yaml' && GITHUB_ACTIONS_WORKFLOW_PATTERN.test(file.relativePath);
}

function isFloatingDockerImage(line: string): boolean {
  const match = line.match(/^\s*FROM\s+(?:--platform=\S+\s+)?([^\s]+)(?:\s+AS\s+\S+)?\s*$/i);
  if (!match?.[1]) {
    return false;
  }

  const imageReference = match[1].trim();
  if (imageReference.includes('@sha256:')) {
    return false;
  }

  const lastSlash = imageReference.lastIndexOf('/');
  const lastColon = imageReference.lastIndexOf(':');
  const tag = lastColon > lastSlash ? imageReference.slice(lastColon + 1) : undefined;

  return tag === undefined || tag.toLowerCase() === 'latest';
}

function extractSensitiveDockerPort(line: string): string | null {
  const match = line.match(/^\s*EXPOSE\s+(.+)$/i);
  if (!match?.[1]) {
    return null;
  }

  const tokens = match[1]
    .split(/\s+/)
    .flatMap((token) => token.split('/'))
    .map((token) => token.trim())
    .filter((token) => /^\d+$/.test(token));

  return tokens.find((token) => DOCKER_SENSITIVE_PORTS.has(token)) ?? null;
}

function hasExplicitNonRootUser(lines: string[]): boolean {
  for (const line of lines) {
    const match = line.match(/^\s*USER\s+([^\s#]+)/i);
    if (!match?.[1]) {
      continue;
    }

    const declaredUser = match[1].trim().replace(/['"]/g, '').toLowerCase();
    if (declaredUser !== 'root' && declaredUser !== '0') {
      return true;
    }
  }
  return false;
}

function isSecretEchoCommand(line: string): boolean {
  return /\bsecrets\.[a-z0-9_]+\b/i.test(line) && /\b(echo|printf|write-host|write-output|tee|cat)\b/i.test(line);
}

function resolveFindingStatus(
  config: AuditConfig,
  finding: Pick<AuditFinding, 'id' | 'ruleId' | 'category'>,
): AuditStatus {
  return (
    config.statuses.findings.byId[finding.id] ??
    config.statuses.findings.byRuleId[finding.ruleId] ??
    config.statuses.findings.byCategory[finding.category] ??
    'pendiente'
  );
}

function withControlStatus(control: AuditControl, config: AuditConfig): AuditControl {
  return {
    ...control,
    status: config.statuses.controls.byId[control.id] ?? config.statuses.controls.byCategory[control.category] ?? 'pendiente',
  };
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
