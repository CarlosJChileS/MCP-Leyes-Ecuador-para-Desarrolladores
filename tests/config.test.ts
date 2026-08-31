import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAuditConfig } from '../src/config.js';

async function createRepoFixture(structure: Record<string, string>) {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'repo-config-'));
  const repoRoot = join(workspaceRoot, 'repo');
  await mkdir(repoRoot, { recursive: true });

  for (const [relativePath, content] of Object.entries(structure)) {
    const filePath = join(repoRoot, relativePath);
    await mkdir(join(filePath, '..'), { recursive: true });
    await writeFile(filePath, content);
  }

  return { repoRoot };
}

describe('loadAuditConfig', () => {
  it('returns safe defaults when .mcp-audit.json does not exist', async () => {
    const { repoRoot } = await createRepoFixture({
      'src/index.ts': 'export const ready = true;\n',
    });

    const result = await loadAuditConfig(repoRoot);

    expect(result).toEqual({
      exists: false,
      path: join(repoRoot, '.mcp-audit.json'),
      warnings: [],
      config: {
        limits: {},
        excludePaths: [],
        statuses: {
          findings: {
            byId: {},
            byRuleId: {},
            byCategory: {},
          },
          controls: {
            byId: {},
            byCategory: {},
          },
        },
      },
    });
  });

  it('parses a valid .mcp-audit.json and preserves supported statuses', async () => {
    const { repoRoot } = await createRepoFixture({
      '.mcp-audit.json': JSON.stringify({
        limits: {
          maxDepth: 2,
          maxFiles: 40,
        },
        excludePaths: ['fixtures/generated'],
        statuses: {
          findings: {
            byId: {
              'secret-exposed:src/app.ts:1': 'no cumple',
            },
            byRuleId: {
              'missing-privacy-docs': 'no aplica',
            },
            byCategory: {
              secretos: 'pendiente',
            },
          },
          controls: {
            byId: {
              'control-secretos': 'cumple',
            },
            byCategory: {
              documentacion: 'no aplica',
              general: 'pendiente',
            },
          },
        },
      }, null, 2),
    });

    const result = await loadAuditConfig(repoRoot);

    expect(result.warnings).toEqual([]);
    expect(result.exists).toBe(true);
    expect(result.config).toEqual({
      limits: {
        maxDepth: 2,
        maxFiles: 40,
      },
      excludePaths: ['fixtures/generated'],
      statuses: {
        findings: {
          byId: {
            'secret-exposed:src/app.ts:1': 'no cumple',
          },
          byRuleId: {
            'missing-privacy-docs': 'no aplica',
          },
          byCategory: {
            secretos: 'pendiente',
          },
        },
        controls: {
          byId: {
            'control-secretos': 'cumple',
          },
          byCategory: {
            documentacion: 'no aplica',
            general: 'pendiente',
          },
        },
      },
    });
  });

  it('falls back safely and records warnings for malformed or invalid config values', async () => {
    const { repoRoot } = await createRepoFixture({
      '.mcp-audit.json': JSON.stringify({
        limits: {
          maxDepth: 0,
          maxFiles: 'a lot',
          maxFileSizeBytes: 2048,
        },
        excludePaths: ['docs'],
        statuses: {
          findings: {
            byRuleId: {
              'secret-exposed': 'bloqueado',
              'missing-privacy-docs': 'no aplica',
            },
          },
          controls: {
            byCategory: {
              general: 'cumple',
              secretos: 'tal vez',
            },
          },
        },
      }, null, 2),
    });

    const result = await loadAuditConfig(repoRoot);

    expect(result.exists).toBe(true);
    expect(result.config).toEqual({
      limits: {
        maxFileSizeBytes: 2048,
      },
      excludePaths: ['docs'],
      statuses: {
        findings: {
          byId: {},
          byRuleId: {
            'missing-privacy-docs': 'no aplica',
          },
          byCategory: {},
        },
        controls: {
          byId: {},
          byCategory: {
            general: 'cumple',
          },
        },
      },
    });
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('limits.maxDepth'),
      expect.stringContaining('limits.maxFiles'),
      expect.stringContaining('statuses.findings.byRuleId.secret-exposed'),
      expect.stringContaining('statuses.controls.byCategory.secretos'),
    ]));
  });
});
