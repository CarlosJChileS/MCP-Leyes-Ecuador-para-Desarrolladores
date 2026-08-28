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
