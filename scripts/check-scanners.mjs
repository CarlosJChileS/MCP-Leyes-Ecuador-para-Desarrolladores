import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanDependencyVulnerabilities } from '../dist/dependencies.js';

const root = mkdtempSync(join(tmpdir(), 'mcp-live-scanners-'));
writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'audit-fixture', version: '1.0.0', dependencies: { lodash: '4.17.20' } }));
execFileSync(process.execPath, [process.env.npm_execpath, 'install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: root, stdio: 'pipe', timeout: 120000, windowsHide: true });
const report = await scanDependencyVulnerabilities(root, { timeoutMs: 30000 });
const npm = report.scanners.find(scanner => scanner.scanner === 'npm');
assert.equal(npm.status, 'completed', JSON.stringify(npm.warnings));
assert(npm.findings.some(finding => finding.packageName === 'lodash'), 'Expected known vulnerable lodash release');
console.log(JSON.stringify({ generatedAt: new Date().toISOString(), platform: process.platform, node: process.version, fixture: 'lodash@4.17.20 (lockfile only; no project code executed)', scanners: report.scanners.map(({ scanner, status, findings, warnings }) => ({ scanner, status, findings: findings.length, warnings })) }, null, 2));
