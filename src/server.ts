import { McpServer, fromJsonSchema } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { LegalCatalog } from './catalog.js';
import { auditRepository, type AuditCategory, type AuditFinding, type AuditReference, type AuditReport } from './audit.js';
import { assessProject, auditChecklist } from './compliance.js';
import type { LegalSource } from './domain.js';
import { z } from 'zod';

const disclaimer = 'Orientación preliminar; no constituye dictamen ni certificación jurídica. Verifique siempre la fuente oficial.';
const input = (properties: Record<string, unknown>, required: string[] = []) => fromJsonSchema({ type: 'object', properties: properties as any, required, additionalProperties: false });
const profile = input({ name: { type: 'string', minLength: 1, maxLength: 200 }, processesPersonalData: { type: 'boolean' }, usesProviders: { type: 'boolean' }, sellsOnline: { type: 'boolean' }, storesSensitiveData: { type: 'boolean' } }, ['name']);
const text = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] });
const auditInput = input({
  path: { type: 'string', minLength: 1, maxLength: 4096 },
  maxDepth: { type: 'integer', minimum: 1, maximum: 12 },
  maxFiles: { type: 'integer', minimum: 1, maximum: 2000 },
  maxFileSizeBytes: { type: 'integer', minimum: 1024, maximum: 1048576 },
}, ['path']);

const categoryTopics: Record<AuditCategory, string[]> = {
  secretos: ['seguridad', 'datos personales'],
  datos_personales: ['datos personales', 'privacidad'],
  logs_sensibles: ['seguridad', 'datos personales'],
  transporte_inseguro: ['seguridad', 'mensajes de datos', 'comercio electrónico'],
  cors: ['seguridad', 'comercio electrónico'],
  cookies: ['privacidad', 'seguridad'],
  endpoints_sensibles: ['seguridad', 'comercio electrónico'],
  documentacion: ['privacidad', 'datos personales'],
};

export function createServer(catalog: LegalCatalog) {
  const server = new McpServer({ name: 'mcp-leyes-ecuador-para-desarrolladores', version: '0.1.0' });
  server.registerTool('buscar_normativa', { description: 'Busca normativa ecuatoriana verificable por texto y tema.', inputSchema: input({ query: { type: 'string', maxLength: 200 }, topic: { type: 'string', maxLength: 100 } }) }, async ({ query = '', topic }: any) => text({ results: catalog.search(query, topic), disclaimer }));
  server.registerTool('consultar_obligacion', { description: 'Consulta una ficha normativa por identificador.', inputSchema: input({ id: { type: 'string', minLength: 1, maxLength: 100 } }, ['id']) }, async ({ id }: any) => { const source = catalog.get(id); return text(source ? { source, disclaimer } : { error: 'Norma no encontrada', disclaimer }); });
  server.registerTool('verificar_vigencia', { description: 'Devuelve estado y fecha de verificación de una fuente.', inputSchema: input({ id: { type: 'string', minLength: 1, maxLength: 100 } }, ['id']) }, async ({ id }: any) => { const source = catalog.get(id); return text(source ? { id: source.id, title: source.title, status: source.status, verifiedAt: source.verifiedAt, url: source.url, disclaimer } : { error: 'Fuente no encontrada', disclaimer }); });
  server.registerTool('evaluar_proyecto', { description: 'Genera riesgos y controles preliminares para un proyecto.', inputSchema: profile }, async (project: any) => text(assessProject(project, catalog.all())));
  server.registerTool('generar_checklist_auditoria', { description: 'Genera una lista reproducible de evidencias para auditoría.', inputSchema: profile }, async (project: any) => text(auditChecklist(project, catalog.all())));
  server.registerTool('auditar_repositorio', {
    description: 'Ejecuta una auditoría estática local y de solo lectura sobre un repositorio con límites seguros.',
    inputSchema: auditInput,
  }, async ({ path, maxDepth, maxFiles, maxFileSizeBytes }: any) => {
    try {
      const report = await auditRepository(path, { maxDepth, maxFiles, maxFileSizeBytes });
      return text(adaptAuditReport(report, catalog));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo auditar el repositorio';
      return text({ error: message, disclaimer });
    }
  });
  server.registerResource('indice-normativa', 'legal://normativa', { title: 'Índice de normativa ecuatoriana', description: 'Fuentes locales curadas y verificables', mimeType: 'application/json' }, async (uri) => ({ contents: [{ uri: uri.href, text: JSON.stringify(catalog.all().map(({ id, title, status, verifiedAt }) => ({ id, title, status, verifiedAt })), null, 2), mimeType: 'application/json' }] }));
  server.registerResource('ficha-normativa', 'legal://normativa/{id}', { title: 'Ficha normativa', mimeType: 'application/json' }, async (uri) => { const id = uri.pathname.split('/').pop(); const source = id ? catalog.get(id) : undefined; return { contents: [{ uri: uri.href, text: JSON.stringify(source ?? { error: 'Norma no encontrada' }, null, 2), mimeType: 'application/json' }] }; });
  server.registerPrompt('revision-privacidad', { description: 'Prepara una revisión preliminar de privacidad.', argsSchema: { project: z.string().min(1).max(500).describe('Nombre y contexto del proyecto') } }, ({ project }: any) => ({ messages: [{ role: 'user' as const, content: { type: 'text' as const, text: `Evalúa preliminarmente la privacidad del proyecto ${project}. Usa evaluar_proyecto, identifica datos faltantes y cita fuentes. ${disclaimer}` } }] }));
  return server;
}

export async function main() { const catalog = await LegalCatalog.load(); await serveStdio(() => createServer(catalog)); }
if (process.env.NODE_ENV !== 'test') await main();

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
