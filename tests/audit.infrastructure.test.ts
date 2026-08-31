import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditRepository } from '../src/audit.js';

async function createRepoFixture(structure: Record<string, string>) {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'repo-audit-infra-'));
  const repoRoot = join(workspaceRoot, 'repo');
  await mkdir(repoRoot, { recursive: true });

  for (const [relativePath, content] of Object.entries(structure)) {
    const filePath = join(repoRoot, relativePath);
    await mkdir(join(filePath, '..'), { recursive: true });
    await writeFile(filePath, content);
  }

  return { repoRoot };
}

describe('auditRepository infrastructure rules', () => {
  it('reports Docker, GitHub Actions and Terraform risks with focused rule ids', async () => {
    const { repoRoot } = await createRepoFixture({
      'docs/privacy.md': '# Privacy\n',
      Dockerfile: ['FROM node:latest', 'EXPOSE 2375', 'CMD ["node", "server.js"]', ''].join('\n'),
      '.github/workflows/deploy.yml': [
        'name: Deploy',
        'on: push',
        'jobs:',
        '  deploy:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - run: echo "${{ secrets.PROD_API_TOKEN }}"',
        '',
      ].join('\n'),
      'infra/main.tf': [
        'resource "aws_security_group" "public" {',
        '  ingress {',
        '    from_port   = 5432',
        '    to_port     = 5432',
        '    protocol    = "tcp"',
        '    cidr_blocks = ["0.0.0.0/0"]',
        '  }',
        '}',
        '',
        'resource "aws_db_instance" "db" {',
        '  publicly_accessible = true',
        '  storage_encrypted   = false',
        '}',
        '',
      ].join('\n'),
    });

    const report = await auditRepository(repoRoot, { maxDepth: 5 });
    const ruleIds = report.findings.map((finding) => finding.ruleId);

    expect(ruleIds).toEqual(
      expect.arrayContaining([
        'docker-floating-image',
        'docker-root-user',
        'docker-exposed-port',
        'github-actions-secret-exposure',
        'terraform-public-resource',
        'terraform-missing-encryption',
      ]),
    );

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'docker-root-user',
          category: 'infraestructura',
          language: 'docker',
          path: 'Dockerfile',
          status: 'pendiente',
        }),
        expect.objectContaining({
          ruleId: 'github-actions-secret-exposure',
          category: 'infraestructura',
          language: 'yaml',
          path: '.github/workflows/deploy.yml',
        }),
        expect.objectContaining({
          ruleId: 'terraform-public-resource',
          category: 'infraestructura',
          language: 'terraform',
          path: 'infra/main.tf',
        }),
      ]),
    );
  });

  it('avoids infrastructure findings for a tighter baseline configuration', async () => {
    const { repoRoot } = await createRepoFixture({
      'docs/privacy.md': '# Privacy\n',
      Dockerfile: ['FROM node:20-alpine', 'USER node', 'EXPOSE 3000', 'CMD ["node", "server.js"]', ''].join('\n'),
      '.github/workflows/deploy.yml': [
        'name: Deploy',
        'on: push',
        'jobs:',
        '  deploy:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - uses: actions/checkout@v4',
        '      - env:',
        '          PROD_API_TOKEN: ${{ secrets.PROD_API_TOKEN }}',
        '        run: npm run deploy',
        '',
      ].join('\n'),
      'infra/main.tf': [
        'resource "aws_security_group" "private" {',
        '  ingress {',
        '    from_port   = 5432',
        '    to_port     = 5432',
        '    protocol    = "tcp"',
        '    cidr_blocks = ["10.0.0.0/16"]',
        '  }',
        '}',
        '',
        'resource "aws_db_instance" "db" {',
        '  publicly_accessible = false',
        '  storage_encrypted   = true',
        '}',
        '',
      ].join('\n'),
    });

    const report = await auditRepository(repoRoot, { maxDepth: 5 });
    const infraFindings = report.findings.filter((finding) => finding.category === 'infraestructura');

    expect(infraFindings).toEqual([]);
  });
});
