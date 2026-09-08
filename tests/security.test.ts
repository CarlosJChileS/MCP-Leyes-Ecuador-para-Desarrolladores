import { mkdtemp, mkdir, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { auditRepository } from '../src/audit.js';
import { createLocalCommandRunner } from '../src/dependencies.js';

it('redacts secrets and literal personal data across overlapping findings', async () => {
  const root = await mkdtemp(join(tmpdir(), 'audit-redaction-'));
  await writeFile(join(root, 'app.js'), 'const email = "someone@example.test"; const password = "fixture-secret-123"; fetch("http://example.test?token=fixture-query-456");');
  const report = await auditRepository(root);
  expect(report.findings.some(x => x.ruleId === 'insecure-http')).toBe(true);
  const serialized = JSON.stringify(report);
  for (const secret of ['someone@example.test', 'fixture-secret-123', 'fixture-query-456']) expect(serialized).not.toContain(secret);
});

it('prunes excluded paths before consuming the file budget and rejects oversized config limits', async () => {
  const root = await mkdtemp(join(tmpdir(), 'audit-limits-'));
  await mkdir(join(root, 'aaa'));
  await writeFile(join(root, 'aaa/noise.js'), 'const okay = true;');
  await writeFile(join(root, 'zzz.js'), 'const secret = "fixture-secret-123";');
  await writeFile(join(root, '.mcp-audit.json'), JSON.stringify({ excludePaths: ['aaa'] }));
  const report = await auditRepository(root, { maxFiles: 2 });
  expect(report.findings.some(x => x.path === 'zzz.js')).toBe(true);
  await writeFile(join(root, '.mcp-audit.json'), JSON.stringify({ limits: { maxFiles: 999999 } }));
  await expect(auditRepository(root)).rejects.toThrow('límite seguro');
});

it('rejects a configuration directory link before reading outside the root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'audit-config-link-'));
  const outside = await mkdtemp(join(tmpdir(), 'audit-outside-'));
  await symlink(outside, join(root, '.mcp-audit.json'), process.platform === 'win32' ? 'junction' : 'dir');
  await expect(auditRepository(root)).rejects.toThrow('archivo regular');
});

it('terminates real external commands at the timeout and output limit', async () => {
  const runner = createLocalCommandRunner();
  const request = { scanner: 'npm' as const, command: process.execPath, cwd: tmpdir(), target: 'test', timeoutMs: 300, maxOutputBytes: 1024 };
  const timeout = await runner({ ...request, args: ['-e', 'setInterval(()=>{},1000)'] });
  expect(timeout.timedOut).toBe(true);
  const output = await runner({ ...request, timeoutMs: 5000, args: ['-e', 'process.stdout.write("a".repeat(100000))'] });
  expect(output.outputLimitExceeded).toBe(true);
  expect(Buffer.byteLength(output.stdout)).toBeLessThanOrEqual(1024);
}, 10000);
