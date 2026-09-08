import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const npmCli = process.env.npm_execpath;
assert(npmCli, 'Run through npm run verify:package');
const temp = mkdtempSync(join(tmpdir(), 'mcp-package-'));
const npm = args => execFileSync(process.execPath, [npmCli, ...args], { cwd: temp, encoding: 'utf8', timeout: 120000, windowsHide: true });
const packed = JSON.parse(execFileSync(process.execPath, [npmCli, 'pack', '--json', '--ignore-scripts', '--pack-destination', temp], { encoding: 'utf8', windowsHide: true }))[0];
assert(packed.files.some(x => x.path === 'data/normativa.json'));
assert(packed.files.some(x => x.path === 'LICENSE'));
assert(!packed.files.some(x => /(?:^|\/)(?:\.env|\.release-work|tests|node_modules)(?:\/|$)/.test(x.path)));
npm(['install', '--prefix', temp, '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund', join(temp, packed.filename)]);
const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const installed = join(temp, 'node_modules', pkg.name);
const installedPackage = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
assert.equal(installedPackage.bin['leyes-ecuador-dev-mcp'], 'dist/server.js');
const client = new Client({ name: 'clean-package-install', version: '1.0.0' });
try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(installed, 'dist/server.js')], cwd: tmpdir() }));
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 12);
  const resource = await client.readResource({ uri: 'legal://normativa/lopdp' });
  assert.equal(JSON.parse(resource.contents[0].text).id, 'lopdp');
  const obligations = await client.callTool({ name: 'consultar_obligacion', arguments: { id: 'lopdp' } });
  assert(JSON.parse(obligations.content[0].text).obligations.length > 0);
} finally { await client.close(); }
console.log(JSON.stringify({ status: 'passed', version: pkg.version, platform: process.platform, node: process.version, files: packed.files.length, bytes: packed.size, sha512: packed.integrity, archive: join(temp, packed.filename) }, null, 2));
