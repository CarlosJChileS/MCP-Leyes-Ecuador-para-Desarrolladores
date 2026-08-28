import { describe, expect, it } from 'vitest';
import { LegalCatalog } from '../src/catalog.js';
import { createServer } from '../src/server.js';

describe('MCP server contract', () => {
  it('registers all tools, resources and reusable prompt', async () => {
    const server = createServer(await LegalCatalog.load()) as any;
    expect(Object.keys(server._registeredTools)).toEqual(expect.arrayContaining([
      'buscar_normativa', 'consultar_obligacion', 'verificar_vigencia',
      'evaluar_proyecto', 'generar_checklist_auditoria'
    ]));
    expect(Object.keys(server._registeredResources)).toEqual(expect.arrayContaining(['legal://normativa', 'legal://normativa/{id}']));
    expect(Object.keys(server._registeredPrompts)).toContain('revision-privacidad');
  });

  it('registers the repository audit tool', async () => {
    const server = createServer(await LegalCatalog.load()) as any;
    expect(Object.keys(server._registeredTools)).toContain('auditar_repositorio');
  });
});
