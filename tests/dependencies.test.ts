import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SUPPORTED_DEPENDENCY_SCANNERS,
  scanDependencyVulnerabilities,
  type DependencyCommandRequest,
  type DependencyCommandResult,
} from '../src/dependencies.js';

async function createRepoFixture(structure: Record<string, string>) {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'dependency-audit-'));
  const repoRoot = join(workspaceRoot, 'repo');
  await mkdir(repoRoot, { recursive: true });

  for (const [relativePath, content] of Object.entries(structure)) {
    const filePath = join(repoRoot, relativePath);
    await mkdir(join(filePath, '..'), { recursive: true });
    await writeFile(filePath, content);
  }

  return { repoRoot };
}

function createCommandResult(result: Partial<DependencyCommandResult> & Pick<DependencyCommandResult, 'stdout'>): DependencyCommandResult {
  return {
    exitCode: 0,
    stderr: '',
    timedOut: false,
    ...result,
  };
}

describe('scanDependencyVulnerabilities', () => {
  it('runs bounded commands for applicable scanners and parses structured results', async () => {
    const { repoRoot } = await createRepoFixture({
      'web/package.json': '{"name":"web","version":"1.0.0"}\n',
      'web/package-lock.json': '{"name":"web","lockfileVersion":3}\n',
      'api/requirements.txt': 'django==2.2\n',
      'native/Cargo.lock': 'version = 3\n',
      'dotnet/App.csproj': '<Project Sdk="Microsoft.NET.Sdk"></Project>\n',
    });

    const requests: DependencyCommandRequest[] = [];
    const runner = async (request: DependencyCommandRequest): Promise<DependencyCommandResult> => {
      requests.push(request);

      if (request.scanner === 'npm') {
        return createCommandResult({
          exitCode: 1,
          stdout: JSON.stringify({
            vulnerabilities: {
              lodash: {
                name: 'lodash',
                severity: 'high',
                isDirect: true,
                via: [
                  {
                    source: 1106913,
                    name: 'lodash',
                    dependency: 'lodash',
                    title: 'Command Injection in lodash',
                    url: 'https://github.com/advisories/GHSA-35jh-r3h4-6jhm',
                    severity: 'high',
                    range: '<4.17.21',
                  },
                ],
                fixAvailable: {
                  name: 'lodash',
                  version: '4.17.21',
                  isSemVerMajor: false,
                },
              },
            },
          }),
        });
      }

      if (request.scanner === 'pip-audit') {
        return createCommandResult({
          exitCode: 1,
          stdout: JSON.stringify([
            {
              name: 'django',
              version: '2.2',
              vulns: [
                {
                  id: 'PYSEC-2022-001',
                  aliases: ['CVE-2022-0001'],
                  description: 'SQL injection vulnerability',
                  fix_versions: ['2.2.25'],
                },
              ],
            },
          ]),
        });
      }

      if (request.scanner === 'cargo-audit') {
        return createCommandResult({
          exitCode: 1,
          stdout: JSON.stringify({
            vulnerabilities: {
              list: [
                {
                  package: { name: 'time', version: '0.1.0' },
                  advisory: {
                    id: 'RUSTSEC-2020-0159',
                    title: 'Potential segfault',
                    cvss: { severity: 'medium' },
                  },
                  versions: {
                    patched: ['0.2.23'],
                  },
                },
              ],
            },
          }),
        });
      }

      if (request.scanner === 'dotnet') {
        return createCommandResult({
          stdout: JSON.stringify({
            projects: [
              {
                path: 'dotnet/App.csproj',
                frameworks: [
                  {
                    framework: 'net8.0',
                    topLevelPackages: [
                      {
                        id: 'Newtonsoft.Json',
                        resolvedVersion: '9.0.1',
                        vulnerabilities: [
                          {
                            severity: 'High',
                            advisoryUrl: 'https://github.com/advisories/GHSA-5crp-9r3c-p9vr',
                            advisoryTitle: 'Deserialization of Untrusted Data',
                          },
                        ],
                      },
                    ],
                    transitivePackages: [],
                  },
                ],
              },
            ],
          }),
        });
      }

      return createCommandResult({
        exitCode: 1,
        stdout: JSON.stringify({
          results: [
            {
              source: {
                path: 'web/package-lock.json',
              },
              packages: [
                {
                  package: {
                    name: 'minimatch',
                    ecosystem: 'npm',
                  },
                  version: '3.0.0',
                  vulnerabilities: [
                    {
                      id: 'GHSA-f8q6-p94x-37v3',
                      summary: 'Regular expression denial of service',
                      database_specific: {
                        severity: 'CRITICAL',
                      },
                      affected: [
                        {
                          ranges: [
                            {
                              events: [{ introduced: '0' }, { fixed: '3.0.5' }],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }),
      });
    };

    const report = await scanDependencyVulnerabilities(repoRoot, {
      runner,
      timeoutMs: 3210,
      maxOutputBytes: 777,
    });

    expect(requests).toEqual([
      {
        scanner: 'npm',
        command: 'npm',
        args: ['audit', '--json'],
        cwd: join(repoRoot, 'web'),
        target: join(repoRoot, 'web', 'package-lock.json'),
        timeoutMs: 3210,
        maxOutputBytes: 777,
      },
      {
        scanner: 'pip-audit',
        command: 'pip-audit',
        args: ['--format', 'json', '--requirement', join(repoRoot, 'api', 'requirements.txt')],
        cwd: repoRoot,
        target: join(repoRoot, 'api', 'requirements.txt'),
        timeoutMs: 3210,
        maxOutputBytes: 777,
      },
      {
        scanner: 'cargo-audit',
        command: 'cargo',
        args: ['audit', '--json'],
        cwd: join(repoRoot, 'native'),
        target: join(repoRoot, 'native', 'Cargo.lock'),
        timeoutMs: 3210,
        maxOutputBytes: 777,
      },
      {
        scanner: 'dotnet',
        command: 'dotnet',
        args: ['list', join(repoRoot, 'dotnet', 'App.csproj'), 'package', '--vulnerable', '--include-transitive', '--format', 'json'],
        cwd: repoRoot,
        target: join(repoRoot, 'dotnet', 'App.csproj'),
        timeoutMs: 3210,
        maxOutputBytes: 777,
      },
      {
        scanner: 'osv-scanner',
        command: 'osv-scanner',
        args: ['--format', 'json', '--recursive', repoRoot],
        cwd: repoRoot,
        target: repoRoot,
        timeoutMs: 3210,
        maxOutputBytes: 777,
      },
    ]);

    expect(report.summary.totalFindings).toBe(5);
    expect(report.summary.findingsBySeverity).toMatchObject({
      critical: 1,
      high: 2,
      medium: 1,
      low: 0,
      unknown: 1,
    });

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scanner: 'npm',
          packageName: 'lodash',
          advisoryId: '1106913',
          fixedVersion: '4.17.21',
          severity: 'high',
          manifestPath: 'web/package-lock.json',
        }),
        expect.objectContaining({
          scanner: 'pip-audit',
          packageName: 'django',
          advisoryId: 'PYSEC-2022-001',
          fixedVersion: '2.2.25',
          severity: 'unknown',
          manifestPath: 'api/requirements.txt',
        }),
        expect.objectContaining({
          scanner: 'cargo-audit',
          packageName: 'time',
          advisoryId: 'RUSTSEC-2020-0159',
          fixedVersion: '0.2.23',
          severity: 'medium',
          manifestPath: 'native/Cargo.lock',
        }),
        expect.objectContaining({
          scanner: 'dotnet',
          packageName: 'Newtonsoft.Json',
          severity: 'high',
          manifestPath: 'dotnet/App.csproj',
        }),
        expect.objectContaining({
          scanner: 'osv-scanner',
          packageName: 'minimatch',
          advisoryId: 'GHSA-f8q6-p94x-37v3',
          fixedVersion: '3.0.5',
          severity: 'critical',
          manifestPath: 'web/package-lock.json',
        }),
      ]),
    );

    expect(report.warnings).toEqual([]);
    expect(report.scanners.every((scanner) => scanner.status === 'completed')).toBe(true);
  });

  it('reports unavailable tools and redacts sensitive output from failures', async () => {
    const { repoRoot } = await createRepoFixture({
      'web/package.json': '{"name":"web","version":"1.0.0"}\n',
      'api/requirements.txt': 'flask==2.0.0\n',
    });

    const runner = async (request: DependencyCommandRequest): Promise<DependencyCommandResult> => {
      if (request.scanner === 'pip-audit') {
        const error = new Error('spawn pip-audit ENOENT') as Error & { code?: string };
        error.code = 'ENOENT';
        throw error;
      }

      if (request.scanner === 'npm') {
        return createCommandResult({
          exitCode: 2,
          stdout: 'Authorization: Bearer super-secret-token-1234567890',
          stderr: 'token=ultra-sensitive-token-0987654321',
        });
      }

      return createCommandResult({ stdout: '' });
    };

    const report = await scanDependencyVulnerabilities(repoRoot, { runner });

    const npmResult = report.scanners.find((scanner) => scanner.scanner === 'npm');
    const pipResult = report.scanners.find((scanner) => scanner.scanner === 'pip-audit');

    expect(npmResult).toMatchObject({
      status: 'failed',
      warnings: [
        expect.objectContaining({
          code: 'invalid_output',
        }),
      ],
    });
    expect(npmResult?.warnings[0]?.output).toContain('[REDACTED]');
    expect(npmResult?.warnings[0]?.output).not.toContain('super-secret-token-1234567890');
    expect(npmResult?.warnings[0]?.output).not.toContain('ultra-sensitive-token-0987654321');

    expect(pipResult).toMatchObject({
      status: 'unavailable',
      warnings: [
        expect.objectContaining({
          code: 'tool_unavailable',
          message: expect.stringContaining('pip-audit'),
        }),
      ],
    });
  });

  it('skips scanners when the repository has no supported manifests', async () => {
    const { repoRoot } = await createRepoFixture({
      'README.md': '# Empty repo\n',
    });

    let invocationCount = 0;
    const runner = async (_request: DependencyCommandRequest): Promise<DependencyCommandResult> => {
      invocationCount += 1;
      return createCommandResult({ stdout: '' });
    };

    const report = await scanDependencyVulnerabilities(repoRoot, { runner });

    expect(invocationCount).toBe(0);
    expect(report.findings).toEqual([]);
    expect(report.scanners).toHaveLength(SUPPORTED_DEPENDENCY_SCANNERS.length);
    expect(report.scanners.every((scanner) => scanner.status === 'skipped')).toBe(true);
  });
});
