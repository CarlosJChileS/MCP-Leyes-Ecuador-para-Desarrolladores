#!/usr/bin/env node
import { McpServer, ResourceTemplate, fromJsonSchema } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { LegalCatalog } from './catalog.js';
import { auditRepository, type AuditCategory, type AuditFinding, type AuditReference, type AuditReport } from './audit.js';
import { assessProject, auditChecklist } from './compliance.js';
import type { LegalSource } from './domain.js';
import { z } from 'zod';
import { scanDependencyVulnerabilities as scanDependencies, type DependencyScanReport } from './dependencies.js';
import { renderAuditReportHtml, renderAuditReportJson, renderAuditReportMarkdown } from './reports.js';
import { disclaimers, normalizeLanguage } from './i18n.js';
import { consultObligations, legalVerification } from './obligations.js';
import { VERSION } from './version.js';
import { redactSensitiveText } from './redact.js';
import { renderAuditReportSarif } from './sarif.js';
import { assessDataTransfer, evaluateDataGovernance, generateDataInventory, generateImpactAssessment, generateResponsibilityMatrix } from './governance.js';
import { buildGovernanceReport, renderGovernanceReportHtml, renderGovernanceReportMarkdown, renderGovernanceReportPdf } from './governance-report.js';
import { isMainModule } from './entrypoint.js';
import { createGovernanceLifecycle } from './governance-lifecycle.js';
import { inferProjectProfile } from './project-profile.js';

const disclaimer = disclaimers.es;
const input = (properties: Record<string, unknown>, required: string[] = []) => fromJsonSchema({ type: 'object', properties: properties as any, required, additionalProperties: false });
const profile = input({ name: { type: 'string', minLength: 1, maxLength: 200 }, repositoryPath: { type: 'string', maxLength: 4096 }, inferProfile: { type: 'boolean' }, processesPersonalData: { type: 'boolean' }, usesProviders: { type: 'boolean' }, sellsOnline: { type: 'boolean' }, storesSensitiveData: { type: 'boolean' }, handlesPayments: { type: 'boolean' }, issuesInvoices: { type: 'boolean' }, internationalTransfers: { type: 'boolean' }, hasEmployees: { type: 'boolean' }, hasMinors: { type: 'boolean' }, language: { type: 'string', enum: ['es', 'en'] } }, ['name']);
const text = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] });
const auditInput = input({
  path: { type: 'string', minLength: 1, maxLength: 4096 },
  maxDepth: { type: 'integer', minimum: 1, maximum: 12 },
  maxFiles: { type: 'integer', minimum: 1, maximum: 2000 },
  maxFileSizeBytes: { type: 'integer', minimum: 1024, maximum: 1048576 },
  format: { type: 'string', enum: ['json', 'markdown', 'html', 'sarif'] },
  language: { type: 'string', enum: ['es', 'en'] },
  dependencyScan: { type: 'boolean' },
  timeout: { type: 'integer', minimum: 1000, maximum: 120000 },
}, ['path']);

const categoryTopics: Record<AuditCategory, string[]> = {
  secretos: ['seguridad', 'datos personales'],
  datos_personales: ['datos personales', 'privacidad'],
  logs_sensibles: ['seguridad', 'datos personales'],
  transporte_inseguro: ['seguridad', 'mensajes de datos', 'comercio electrónico'],
  cors: ['seguridad', 'comercio electrónico'],
  cookies: ['privacidad', 'seguridad'],
  endpoints_sensibles: ['seguridad', 'comercio electrónico'],
  infraestructura: ['seguridad', 'datos personales', 'comercio electrónico'],
  documentacion: ['privacidad', 'datos personales'],
};

export function createServer(catalog: LegalCatalog, injected: { auditRepository?: typeof auditRepository; scanDependencyVulnerabilities?: typeof scanDependencies } = {}) {
  const runAudit = injected.auditRepository ?? auditRepository;
  const runDependencyScan = injected.scanDependencyVulnerabilities ?? scanDependencies;
  const server = new McpServer({ name: 'eculegaldev', version: VERSION });
  server.registerTool('buscar_normativa', { description: 'Busca normativa ecuatoriana verificable por texto y tema. Use language=es o language=en.', inputSchema: input({ query: { type: 'string', maxLength: 200 }, topic: { type: 'string', maxLength: 100 }, language: { type: 'string', enum: ['es', 'en'] } }) }, async ({ query = '', topic, language }: any) => text({ results: catalog.search(query, topic), language: normalizeLanguage(language), disclaimer: disclaimers[normalizeLanguage(language)] }));
  server.registerTool('consultar_obligacion', { description: 'Consulta obligaciones documentadas con artículos, ámbito y evidencias; informa cobertura parcial o pendiente.', inputSchema: input({ id: { type: 'string', minLength: 1, maxLength: 100 }, language: { type: 'string', enum: ['es', 'en'] } }, ['id']) }, async ({ id, language }: any) => { const lang = normalizeLanguage(language); const source = catalog.get(id); return source ? text(consultObligations(source, lang)) : { ...text({ error: lang === 'en' ? 'Regulation not found' : 'Norma no encontrada', language: lang, disclaimer: disclaimers[lang] }), isError: true }; });
  server.registerTool('verificar_vigencia', { description: 'Consulta el estado registrado y su evidencia documental y jurídica. No verifica vigencia en tiempo real.', inputSchema: input({ id: { type: 'string', minLength: 1, maxLength: 100 }, language: { type: 'string', enum: ['es', 'en'] } }, ['id']) }, async ({ id, language }: any) => { const lang = normalizeLanguage(language); const source = catalog.get(id); return source ? text(legalVerification(source, lang)) : { ...text({ error: lang === 'en' ? 'Source not found' : 'Fuente no encontrada', language: lang, disclaimer: disclaimers[lang] }), isError: true }; });
  server.registerTool('evaluar_proyecto', { description: 'Genera un perfil de cumplimiento, obligaciones, riesgos y controles para cualquier proyecto; puede inferir señales desde un repositorio.', inputSchema: profile }, async ({ repositoryPath, inferProfile = false, ...project }: any) => { let inferred; if (inferProfile && repositoryPath) inferred = await inferProjectProfile(repositoryPath); const effective = inferred ? { ...inferred.suggestions, ...project } : project; return text({ ...assessProject(effective, catalog.all(), normalizeLanguage(project.language)), inferredProfile: inferred }); });
  server.registerTool('generar_checklist_auditoria', { description: 'Genera una lista reproducible de evidencias para auditoría.', inputSchema: profile }, async (project: any) => text(auditChecklist(project, catalog.all(), normalizeLanguage(project.language))));
  const governanceProperties = { name: { type: 'string', minLength: 1, maxLength: 200 }, dataTypes: { type: 'array', items: { type: 'string', maxLength: 120 }, maxItems: 100 }, systems: { type: 'array', items: { type: 'string', maxLength: 200 }, maxItems: 100 }, owners: { type: 'array', items: { type: 'string', maxLength: 200 }, maxItems: 100 }, sharesExternally: { type: 'boolean' }, internationalTransfers: { type: 'boolean' }, publicData: { type: 'boolean' }, automatedDecisions: { type: 'boolean' }, retentionDays: { type: 'integer', minimum: 1, maximum: 36500 }, language: { type: 'string', enum: ['es', 'en'] } };
  const governanceInput = input(governanceProperties, ['name']);
  server.registerTool('evaluar_gobernanza_datos', { description: 'Evalúa preliminarmente inventario, roles, calidad, retención, acceso, transferencias e incidentes.', inputSchema: governanceInput }, async (project: any) => text(evaluateDataGovernance(project, catalog.all())));
  server.registerTool('generar_inventario_datos', { description: 'Genera una plantilla de inventario y evidencia de gobernanza de datos.', inputSchema: governanceInput }, async (project: any) => text(generateDataInventory(project)));
  server.registerTool('evaluar_transferencia_datos', { description: 'Genera controles y evidencias para transferencias nacionales o internacionales.', inputSchema: governanceInput }, async (project: any) => text(assessDataTransfer(project, catalog.all())));
  server.registerTool('evaluar_evaluacion_impacto', { description: 'Preclasifica factores de riesgo y estructura de una evaluación de impacto.', inputSchema: governanceInput }, async (project: any) => text(generateImpactAssessment(project, catalog.all())));
  server.registerTool('generar_matriz_responsabilidades', { description: 'Genera una matriz inicial de responsables de gobernanza de datos.', inputSchema: governanceInput }, async (project: any) => text(generateResponsibilityMatrix(project)));
  server.registerTool('generar_informe_gobernanza', {
    description: 'Consolida las cinco evaluaciones y explica cada brecha con riesgo, prioridad, responsable, pasos de solución, evidencia y criterio de cierre; exporta JSON, Markdown, HTML o PDF.',
    inputSchema: input({ ...governanceProperties, repositoryPath: { type: 'string', minLength: 1, maxLength: 4096 }, maxDepth: { type: 'integer', minimum: 1, maximum: 12 }, maxFiles: { type: 'integer', minimum: 1, maximum: 2000 }, maxFileSizeBytes: { type: 'integer', minimum: 1024, maximum: 1048576 }, dependencyScan: { type: 'boolean' }, timeout: { type: 'integer', minimum: 1000, maximum: 120000 }, persist: { type: 'boolean' }, lifecycleActor: { type: 'string', minLength: 1, maxLength: 200 }, format: { type: 'string', enum: ['json', 'markdown', 'html', 'pdf'] } }, ['name']),
  }, async ({ format = 'json', repositoryPath, maxDepth, maxFiles, maxFileSizeBytes, dependencyScan = true, timeout, persist = false, lifecycleActor = 'sistema', ...project }: any) => {
    let technicalAudit: AuditReport | undefined;
    let dependencyAudit: DependencyScanReport | undefined;
    if (repositoryPath) {
      try {
        technicalAudit = adaptAuditReport(await runAudit(repositoryPath, { maxDepth, maxFiles, maxFileSizeBytes }), catalog);
        if (dependencyScan) dependencyAudit = await runDependencyScan(repositoryPath, { timeoutMs: timeout });
      } catch (error) {
        const detail = error instanceof Error ? redactSensitiveText(error.message) : undefined;
        return { ...text({ error: 'No se pudo analizar el repositorio para generar el informe consolidado.', detail, repositoryPath, disclaimer }), isError: true };
      }
    }
    const report = buildGovernanceReport(project, catalog.all(), { technical: technicalAudit, dependencies: dependencyAudit });
    if (persist) {
      if (!repositoryPath) return { ...text({ error: 'persist requiere repositoryPath para guardar el ciclo en el repositorio.', disclaimer }), isError: true };
      const lifecycle = await createGovernanceLifecycle(repositoryPath).recordAudit(report, lifecycleActor);
      (report as any).lifecycle = { auditId: lifecycle.auditId, storage: '.mcp-governance/lifecycle.json', persisted: true, evolution: await createGovernanceLifecycle(repositoryPath).evolution() };
    }
    if (format === 'markdown') return { content: [{ type: 'text' as const, text: renderGovernanceReportMarkdown(report) }] };
    if (format === 'html') return { content: [{ type: 'text' as const, text: renderGovernanceReportHtml(report) }] };
    if (format === 'pdf') {
      const bytes = await renderGovernanceReportPdf(report);
      const slug = project.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'proyecto';
      return text({ fileName: `informe-gobernanza-${slug}.pdf`, mimeType: 'application/pdf', encoding: 'base64', data: Buffer.from(bytes).toString('base64') });
    }
    return text(report);
  });
  server.registerTool('gestionar_ciclo_gobernanza', {
    description: 'Administra auditorías, acciones, fechas límite, responsables, evidencias, excepciones aprobadas e historial persistido en .mcp-governance.',
    inputSchema: input({ repositoryPath: { type: 'string', minLength: 1, maxLength: 4096 }, operation: { type: 'string', enum: ['listar', 'actualizar_accion', 'agregar_evidencia', 'agregar_excepcion'] }, actionId: { type: 'string', maxLength: 100 }, status: { type: 'string', enum: ['pendiente', 'en_progreso', 'cerrada', 'aceptada_temporalmente'] }, owner: { type: 'string', maxLength: 200 }, dueDate: { type: 'string', maxLength: 30 }, description: { type: 'string', maxLength: 1000 }, uri: { type: 'string', maxLength: 4096 }, reason: { type: 'string', maxLength: 2000 }, approvedBy: { type: 'string', maxLength: 200 }, expiresAt: { type: 'string', maxLength: 30 }, actor: { type: 'string', minLength: 1, maxLength: 200 } }, ['repositoryPath', 'operation', 'actor']),
  }, async ({ repositoryPath, operation, actionId, status, owner, dueDate, description, uri, reason, approvedBy, expiresAt, actor }: any) => {
    try {
      const lifecycle = createGovernanceLifecycle(repositoryPath);
      if (operation === 'listar') return text(await lifecycle.load());
      if (!actionId) return { ...text({ error: 'actionId es obligatorio para esta operación.', disclaimer }), isError: true };
      if (operation === 'actualizar_accion') return text(await lifecycle.updateAction(actionId, Object.fromEntries(Object.entries({ status, owner, dueDate }).filter(([, value]) => value !== undefined)), actor));
      if (operation === 'agregar_evidencia') return text(await lifecycle.addEvidence(actionId, { description, uri }, actor));
      if (operation === 'agregar_excepcion') return text(await lifecycle.addException(actionId, { reason, approvedBy, expiresAt }, actor));
      return { ...text({ error: `Operación no soportada: ${operation}`, disclaimer }), isError: true };
    } catch (error) {
      return { ...text({ error: error instanceof Error ? error.message : 'No se pudo actualizar el ciclo de gobernanza.', disclaimer }), isError: true };
    }
  });
  server.registerTool('auditar_repositorio', {
    description: 'Ejecuta una auditoría estática local y de solo lectura sobre un repositorio con límites seguros.',
    inputSchema: auditInput,
  }, async ({ path, maxDepth, maxFiles, maxFileSizeBytes, format = 'json', dependencyScan = true, timeout, language }: any) => {
    const lang = normalizeLanguage(language);
    try {
      const report = await runAudit(path, { maxDepth, maxFiles, maxFileSizeBytes });
      const adapted = adaptAuditReport(report, catalog);
      const dependencies = dependencyScan ? await runDependencyScan(path, { timeoutMs: timeout }) : undefined;
      const renderOptions = { language: lang, dependencyScan: dependencies, includeDependencyWarnings: Boolean(dependencies) };
      if (format === 'markdown') return { content: [{ type: 'text' as const, text: renderAuditReportMarkdown(adapted, renderOptions) }] };
      if (format === 'html') return { content: [{ type: 'text' as const, text: renderAuditReportHtml(adapted, { ...renderOptions, pdfCompatible: true }) }] };
      if (format === 'sarif') return { content: [{ type: 'text' as const, text: renderAuditReportSarif(adapted, dependencies) }] };
      return { content: [{ type: 'text' as const, text: renderAuditReportJson(adapted, renderOptions) }] };
    } catch (error) {
      const detail = error instanceof Error ? redactSensitiveText(error.message) : undefined;
      const message = lang === 'en' ? 'Repository audit failed. Check the path, permissions and audit configuration.' : (detail ?? 'No se pudo auditar el repositorio');
      return { ...text({ error: message, detail, language: lang, disclaimer: disclaimers[lang] }), isError: true };
    }
  });
  server.registerResource('indice-normativa', 'legal://normativa', { title: 'Índice de normativa ecuatoriana', description: 'Fuentes locales curadas y verificables', mimeType: 'application/json' }, async (uri) => ({ contents: [{ uri: uri.href, text: JSON.stringify(catalog.all().map(({ id, title, status, verifiedAt }) => ({ id, title, status, verifiedAt })), null, 2), mimeType: 'application/json' }] }));
  server.registerResource('ficha-normativa', new ResourceTemplate('legal://normativa/{id}', { list: undefined }), { title: 'Ficha normativa', mimeType: 'application/json' }, async (uri, { id }) => { const source = typeof id === 'string' ? catalog.get(id) : undefined; return { contents: [{ uri: uri.href, text: JSON.stringify(source ?? { error: 'Norma no encontrada' }, null, 2), mimeType: 'application/json' }] }; });
  server.registerPrompt('revision-privacidad', { description: 'Prepara una revisión preliminar de privacidad.', argsSchema: { project: z.string().min(1).max(500).describe('Nombre y contexto del proyecto') } }, ({ project }: any) => ({ messages: [{ role: 'user' as const, content: { type: 'text' as const, text: `Evalúa preliminarmente la privacidad del proyecto ${project}. Usa evaluar_proyecto, identifica datos faltantes y cita fuentes. ${disclaimer}` } }] }));
  server.registerPrompt('revision-gobernanza-datos', { description: 'Prepara una revisión preliminar de gobernanza de datos ecuatoriana para un proyecto de software.', argsSchema: { project: z.string().min(1).max(500).describe('Nombre, datos y contexto del proyecto') } }, ({ project }: any) => ({ messages: [{ role: 'user' as const, content: { type: 'text' as const, text: `Evalúa la gobernanza de datos del proyecto ${project} en Ecuador. Usa generar_informe_gobernanza para consolidar evaluación, inventario, transferencias, impacto y responsabilidades. Identifica brechas, evidencias y leyes aplicables. No afirmes vigencia jurídica sin fuente y revisión humana. ${disclaimer}` } }] }));
  return server;
}

export async function main() { const catalog = await LegalCatalog.load(); await serveStdio(() => createServer(catalog)); }
if (isMainModule(import.meta.url, process.argv[1])) {
  await main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'No se pudo iniciar el servidor MCP');
    process.exitCode = 1;
  });
}

function adaptAuditReport(report: AuditReport, catalog: LegalCatalog) {
  const findings = report.findings.map((finding) => ({
    ...finding,
    reference: resolveCatalogReference(catalog, finding.reference, finding.category),
  }));
  const references = dedupeReferences(findings.map((finding) => finding.reference));

  return {
    ...report,
    findings,
    references,
    disclaimer,
  };
}

function resolveCatalogReference(catalog: LegalCatalog, reference: AuditReference, category: AuditCategory): AuditReference {
  const directMatch = catalog.get(reference.id);
  if (directMatch) {
    return mergeCatalogReference(directMatch, reference.rationale);
  }

  const topicSet = new Set(categoryTopics[category].map((topic) => topic.toLowerCase()));
  const fallbackMatch = catalog.all().find((source) => source.topics.some((topic) => topicSet.has(topic.toLowerCase())));

  return fallbackMatch ? mergeCatalogReference(fallbackMatch, reference.rationale) : reference;
}

function mergeCatalogReference(source: LegalSource, rationale: string): AuditReference {
  return {
    id: source.id,
    title: source.title,
    url: source.url,
    verifiedAt: source.verifiedAt,
    status: source.status,
    topic: source.topics[0] ?? 'normativa',
    rationale,
  };
}

function dedupeReferences(references: AuditReference[]) {
  const uniqueReferences = new Map<string, AuditReference>();
  for (const reference of references) {
    uniqueReferences.set(reference.id, reference);
  }
  return [...uniqueReferences.values()].sort((left, right) => left.id.localeCompare(right.id, 'en'));
}
