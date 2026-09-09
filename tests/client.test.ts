import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';

it('interoperates with the official MCP client SDK', async () => {
  const client = new Client({ name: 'release-verification', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [resolve('dist/server.js')], cwd: tmpdir() });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools).toHaveLength(13);
    const result = await client.callTool({ name: 'consultar_obligacion', arguments: { id: 'lopdp', language: 'en' } });
    expect(result.isError).not.toBe(true);
    const resource = await client.readResource({ uri: 'legal://normativa/lopdp' });
    expect(JSON.parse(String(resource.contents[0].text)).id).toBe('lopdp');
    const invalid = await client.callTool({ name: 'auditar_repositorio', arguments: { path: tmpdir(), maxFiles: 999999 } });
    expect(invalid.isError).toBe(true);
  } finally {
    await client.close();
  }
}, 15000);
