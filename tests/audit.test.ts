import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditRepository } from '../src/audit.js';

async function createRepoFixture(structure: Record<string, string>) {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'repo-audit-'));
  const repoRoot = join(workspaceRoot, 'repo');
  await mkdir(repoRoot, { recursive: true });

  for (const [relativePath, content] of Object.entries(structure)) {
    const filePath = join(repoRoot, relativePath);
    await mkdir(join(filePath, '..'), { recursive: true });
    await writeFile(filePath, content);
  }

  return { workspaceRoot, repoRoot };
}

describe('auditRepository', () => {
  it('returns a structured report with findings, controls, references and redacted secrets', async () => {
    const secret = 'sk_live_1234567890abcdef';
    const { repoRoot } = await createRepoFixture({
      'src/app.ts': `export const apiKey = "${secret}";\n`,
      'docs/privacy.md': '# Privacy\nThis fixture documents data handling.\n',
    });

    const report = await auditRepository(repoRoot, { maxDepth: 5 });

    expect(report).toMatchObject({
      summary: expect.any(Object),
      findings: expect.any(Array),
      controls: expect.any(Array),
      references: expect.any(Array),
      disclaimer: expect.any(String),
    });

    const secretFinding = report.findings.find((finding: any) => typeof finding.evidence === 'string' && finding.evidence.includes('[REDACTED]'));
    expect(secretFinding).toBeDefined();
    expect(secretFinding).toMatchObject({
      id: expect.any(String),
      severity: expect.any(String),
      category: expect.any(String),
      path: expect.stringContaining('src/app.ts'),
      explanation: expect.any(String),
      evidence: expect.any(String),
      recommendation: expect.any(String),
      reference: expect.anything(),
      status: 'pendiente',
    });
    expect(secretFinding.evidence).not.toContain(secret);
    expect(secretFinding.evidence).toMatch(/REDACTED|\*\*\*/i);
    expect(report.controls.length).toBeGreaterThan(0);
    expect(report.references.length).toBeGreaterThan(0);
  });

  it('counts detected languages in the summary across the listed ecosystems', async () => {
    const { repoRoot } = await createRepoFixture({
      'js/index.js': 'export const jsReady = true;\n',
      'ts/index.ts': 'export const tsReady: boolean = true;\n',
      'python/app.py': 'ready = True\n',
      'jvm/App.java': 'public class App {}\n',
      'dotnet/Program.cs': 'public class Program {}\n',
      'go/main.go': 'package main\n',
      'rust/main.rs': 'fn main() {}\n',
      'ruby/app.rb': 'puts :ready\n',
      'cpp/main.cpp': 'int main() { return 0; }\n',
      'c/main.c': 'int main(void) { return 0; }\n',
      'swift/App.swift': 'struct App {}\n',
      'dart/main.dart': 'void main() {}\n',
      'sql/schema.sql': 'select 1;\n',
      'shell/deploy.sh': '#!/usr/bin/env sh\n',
      'config/app.yaml': 'ready: true\n',
      'config/app.json': '{"ready": true}\n',
      'config/app.toml': 'ready = true\n',
      'docker/Dockerfile': 'FROM node:20\n',
      'infra/main.tf': 'terraform {}\n',
    });

    const report = await auditRepository(repoRoot, { maxDepth: 5 });

    expect(report.summary).toMatchObject({
      languages: {
        javascript: 1,
        typescript: 1,
        python: 1,
        java: 1,
        csharp: 1,
        go: 1,
        rust: 1,
        ruby: 1,
        cpp: 1,
        c: 1,
        swift: 1,
        dart: 1,
        sql: 1,
        shell: 1,
        yaml: 1,
        json: 1,
        toml: 1,
        docker: 1,
        terraform: 1,
      },
    });
  });

  it('includes the detected language on each finding', async () => {
    const secret = 'sk_live_abcdef1234567890';
    const { repoRoot } = await createRepoFixture({
      'src/index.ts': `export const apiKey = "${secret}";\n`,
      'service/app.py': `API_KEY = "${secret}"\n`,
    });

    const report = await auditRepository(repoRoot, { maxDepth: 5 });
    const tsFinding = report.findings.find((finding: any) => finding.path === 'src/index.ts');
    const pyFinding = report.findings.find((finding: any) => finding.path === 'service/app.py');

    expect(tsFinding).toMatchObject({
      language: 'typescript',
    });
    expect(pyFinding).toMatchObject({
      language: 'python',
    });
  });

  it('skips excluded directories and refuses to read through an outbound link', async () => {
    const excludedNodeModulesSecret = 'excluded-node-modules-secret';
    const excludedDistSecret = 'excluded-dist-secret';
    const linkedSecret = 'linked-outside-secret';
    const { workspaceRoot, repoRoot } = await createRepoFixture({
      'src/index.ts': 'export const ready = true;\n',
      'docs/privacy.md': '# Privacy\n',
      'node_modules/vendor/index.js': `const secret = "${excludedNodeModulesSecret}";\n`,
      'dist/bundle.js': `const secret = "${excludedDistSecret}";\n`,
    });

    const outsideRoot = join(workspaceRoot, 'outside');
    await mkdir(outsideRoot, { recursive: true });
    await writeFile(join(outsideRoot, 'leak.txt'), `const secret = "${linkedSecret}";\n`);

    const linkedDir = join(repoRoot, 'linked-outside');
    await symlink(outsideRoot, linkedDir, process.platform === 'win32' ? 'junction' : 'dir');

    const report = await auditRepository(repoRoot, { maxDepth: 5 });
    const joinedEvidence = report.findings
      .map((finding: any) => `${String(finding.path ?? '')} ${String(finding.evidence ?? '')}`)
      .join('\n');

    expect(joinedEvidence).not.toContain(excludedNodeModulesSecret);
    expect(joinedEvidence).not.toContain(excludedDistSecret);
    expect(joinedEvidence).not.toContain(linkedSecret);
    expect(report.findings.some((finding: any) => {
      const path = String(finding.path ?? '');
      return path.includes('node_modules') || path.includes('dist') || path.includes('linked-outside');
    })).toBe(false);
  });

  it('rejects invalid repository paths', async () => {
    const { workspaceRoot } = await createRepoFixture({
      'src/index.ts': 'export const ready = true;\n',
    });

    await expect(auditRepository(join(workspaceRoot, 'missing-repo'))).rejects.toThrow();
  });
});
