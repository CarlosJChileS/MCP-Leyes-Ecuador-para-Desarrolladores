import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { expect, it } from 'vitest';

it('serves tools, resource templates and prompts over real stdio from another working directory', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'ecuador-mcp-'));
  const child = spawn(process.execPath, [resolve('dist/server.js')], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'test' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const closed = once(child, 'close');
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  let sequence = 0;
  const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  const lines = createInterface({ input: child.stdout });
  const protocolErrors: string[] = [];
  const failAll = (error: Error) => {
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  };
  child.on('error', failAll);
  child.on('close', () => failAll(new Error(`Server closed: ${stderr}`)));
  lines.on('line', line => {
    try {
      const message = JSON.parse(line);
      if (message.jsonrpc !== '2.0') throw new Error('Non-protocol stdout');
      const waiter = pending.get(message.id);
      if (waiter) {
        pending.delete(message.id);
        if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
        else waiter.resolve(message.result);
      }
    } catch (error) {
      protocolErrors.push(line);
      failAll(error as Error);
    }
  });
  const request = (method: string, params: object = {}): Promise<any> => new Promise((res, rej) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); rej(new Error(`Timed out: ${method}; ${stderr}`)); }, 8000);
    pending.set(id, {
      resolve: value => { clearTimeout(timer); res(value); },
      reject: error => { clearTimeout(timer); rej(error); },
    });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  try {
    await writeFile(resolve(root, 'app.js'), 'fetch("http://example.com/Generado");\n');
    const initialized = await request('initialize', {
      protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'integration-test', version: '1.0.0' },
    });
    expect(initialized.serverInfo.name).toBe('eculegaldev');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const tools = await request('tools/list');
    expect(tools.tools).toHaveLength(13);
    expect(tools.tools.find((tool: any) => tool.name === 'auditar_repositorio').inputSchema.properties.language.enum).toEqual(['es', 'en']);
    const call = (name: string, args: object) => request('tools/call', { name, arguments: args });
    const search = await call('buscar_normativa', { query: 'lopdp', language: 'en' });
    expect(JSON.parse(search.content[0].text).results[0].id).toBe('lopdp');
    for (const name of ['consultar_obligacion', 'verificar_vigencia']) {
      const result = await call(name, { id: 'lopdp', language: 'en' });
      expect(JSON.parse(result.content[0].text).disclaimer).toContain('Preliminary guidance');
    }
    for (const name of ['evaluar_proyecto', 'generar_checklist_auditoria']) {
      const result = await call(name, { name: 'Demo', processesPersonalData: true, language: 'en' });
      expect(result.isError).not.toBe(true);
      expect(JSON.parse(result.content[0].text).disclaimer).toContain('Preliminary guidance');
    }
    const audit = await call('auditar_repositorio', { path: root, language: 'en' });
    const report = JSON.parse(audit.content[0].text);
    const finding = report.findings.find((item: any) => item.ruleId === 'insecure-http');
    expect(finding.explanation).toContain('insecure HTTP');
    expect(finding.evidence).toContain('/Generado');
    expect(report.executiveSummary.headline).toContain('findings detected');
    expect(report.controls.every((control: any) => !control.title.includes('Revisar'))).toBe(true);
    for (const format of ['markdown', 'html']) {
      const result = await call('auditar_repositorio', { path: root, language: 'en', format });
      expect(result.content[0].text).toContain('Audit report');
      expect(result.content[0].text).toContain('/Generado');
      expect(result.content[0].text).not.toContain('Resumen ejecutivo');
      expect(result.content[0].text).toContain('Dependency scanner status');
      if (format === 'html') expect(result.content[0].text).toContain('<html lang="en">');
    }
    const invalid = await call('auditar_repositorio', { path: resolve(root, 'missing'), language: 'en' });
    expect(invalid.isError).toBe(true);
    expect(JSON.parse(invalid.content[0].text).error).toContain('Repository audit failed');
    const templates = await request('resources/templates/list');
    expect(templates.resourceTemplates[0].uriTemplate).toBe('legal://normativa/{id}');
    const index = await request('resources/read', { uri: 'legal://normativa' });
    expect(JSON.parse(index.contents[0].text).length).toBeGreaterThan(0);
    const resource = await request('resources/read', { uri: 'legal://normativa/lopdp' });
    expect(JSON.parse(resource.contents[0].text).id).toBe('lopdp');
    const prompt = await request('prompts/get', { name: 'revision-privacidad', arguments: { project: 'Demo' } });
    expect(prompt.messages[0].content.text).toContain('Demo');
    expect(protocolErrors).toEqual([]);
  } finally {
    child.stdin.end();
    const timer = setTimeout(() => child.kill(), 1500);
    await closed;
    clearTimeout(timer);
    lines.close();
    await rm(root, { recursive: true, force: true });
  }
}, 30000);
