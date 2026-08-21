import { McpServer, fromJsonSchema } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { LegalCatalog } from './catalog.js';
import { assessProject, auditChecklist } from './compliance.js';

const catalog = await LegalCatalog.load();
const server = new McpServer({ name: 'mcp-leyes-ecuador-para-desarrolladores', version: '0.1.0' });
const profile = fromJsonSchema({ type: 'object', properties: { name: { type: 'string' }, processesPersonalData: { type: 'boolean' }, usesProviders: { type: 'boolean' }, sellsOnline: { type: 'boolean' }, storesSensitiveData: { type: 'boolean' } }, required: ['name'] });
const input = (properties: Record<string, unknown>, required: string[] = []) => fromJsonSchema({ type: 'object', properties: properties as any, required });
server.registerTool('buscar_normativa', { description: 'Busca normativa ecuatoriana verificable por texto y tema.', inputSchema: input({ query: { type: 'string' }, topic: { type: 'string' } }) }, async ({ query = '', topic }: any) => ({ content: [{ type: 'text', text: JSON.stringify({ results: catalog.search(query, topic), disclaimer: 'Información preliminar; verifique la fuente antes de decidir.' }, null, 2) }] }));
server.registerTool('consultar_obligacion', { description: 'Consulta una ficha normativa por identificador.', inputSchema: input({ id: { type: 'string' } }, ['id']) }, async ({ id }: any) => ({ content: [{ type: 'text', text: JSON.stringify(catalog.get(id) ?? { error: 'Norma no encontrada' }, null, 2) }] }));
server.registerTool('verificar_vigencia', { description: 'Devuelve estado y fecha de verificación de una fuente.', inputSchema: input({ id: { type: 'string' } }, ['id']) }, async ({ id }: any) => { const source = catalog.get(id); return { content: [{ type: 'text', text: JSON.stringify(source ? { id: source.id, title: source.title, status: source.status, verifiedAt: source.verifiedAt, url: source.url } : { error: 'Fuente no encontrada' }, null, 2) }] }; });
server.registerTool('evaluar_proyecto', { description: 'Genera riesgos y controles preliminares para un proyecto.', inputSchema: profile } as any, async (project: any) => ({ content: [{ type: 'text', text: JSON.stringify(assessProject(project, catalog.all()), null, 2) }] }));
server.registerTool('generar_checklist_auditoria', { description: 'Genera una lista reproducible de evidencias para auditoría.', inputSchema: profile } as any, async (project: any) => ({ content: [{ type: 'text', text: JSON.stringify(auditChecklist(project, catalog.all()), null, 2) }] }));

if (process.env.NODE_ENV !== 'test') await (serveStdio as any)(server);
export { server };
