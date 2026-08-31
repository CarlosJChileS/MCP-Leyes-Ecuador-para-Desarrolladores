import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path';

export const SUPPORTED_DEPENDENCY_SCANNERS = ['npm', 'pip-audit', 'cargo-audit', 'dotnet', 'osv-scanner'] as const;

export type DependencyScannerName = (typeof SUPPORTED_DEPENDENCY_SCANNERS)[number];
export type DependencySeverity = 'critical' | 'high' | 'medium' | 'low' | 'unknown';
export type DependencyScannerStatus = 'completed' | 'failed' | 'unavailable' | 'skipped';
export type DependencyWarningCode =
  | 'tool_unavailable'
  | 'command_failed'
  | 'command_timed_out'
  | 'invalid_output'
  | 'output_limit_exceeded';

export type DependencyCommandRequest = {
  scanner: DependencyScannerName;
  command: string;
  args: string[];
  cwd: string;
  target: string;
  timeoutMs: number;
  maxOutputBytes: number;
};

export type DependencyCommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
  outputLimitExceeded?: boolean;
};

export type DependencyCommandRunner = (request: DependencyCommandRequest) => Promise<DependencyCommandResult>;

export type DependencyFinding = {
  id: string;
  scanner: DependencyScannerName;
  ecosystem: string;
  packageName: string;
  severity: DependencySeverity;
  summary: string;
  manifestPath: string;
  installedVersion?: string;
  fixedVersion?: string;
  advisoryId?: string;
  advisoryUrl?: string;
  direct?: boolean;
};

export type DependencyWarning = {
  scanner: DependencyScannerName;
  code: DependencyWarningCode;
  message: string;
  target?: string;
  output?: string;
};

export type DependencyExecution = {
  scanner: DependencyScannerName;
  status: Exclude<DependencyScannerStatus, 'skipped'>;
  command: string[];
  cwd: string;
  target: string;
  findings: DependencyFinding[];
  warnings: DependencyWarning[];
};

export type DependencyScannerResult = {
  scanner: DependencyScannerName;
  status: DependencyScannerStatus;
  targets: string[];
  executions: DependencyExecution[];
  findings: DependencyFinding[];
  warnings: DependencyWarning[];
};

export type DependencyScanSummary = {
  totalFindings: number;
  findingsBySeverity: Record<DependencySeverity, number>;
  scannersByStatus: Record<DependencyScannerStatus, number>;
};

export type DependencyScanReport = {
  rootPath: string;
  generatedAt: string;
  scanners: DependencyScannerResult[];
  findings: DependencyFinding[];
  warnings: DependencyWarning[];
  summary: DependencyScanSummary;
};

export type DependencyScanOptions = {
  runner?: DependencyCommandRunner;
  timeoutMs?: number;
  maxOutputBytes?: number;
  maxDepth?: number;
};

type ScannerTarget = {
  manifestPath: string;
  cwd: string;
};

type ManifestBuckets = {
  npm: string[];
  pip: string[];
  cargo: string[];
  dotnet: string[];
};

type ParserContext = {
  rootPath: string;
  manifestPath: string;
  scanner: DependencyScannerName;
};

type FindingDraft = Omit<DependencyFinding, 'id' | 'scanner' | 'manifestPath'>;

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_BYTES = 256 * 1024;
const DEFAULT_MAX_DEPTH = 6;
const OUTPUT_PREVIEW_LIMIT = 1200;

const EXCLUDED_DIRECTORIES = new Set([
  '.git',
  '.hg',
  '.next',
  '.nuxt',
  '.svn',
  '.turbo',
  '.yarn',
  'bin',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'target',
  'tmp',
  'vendor',
]);

const SEVERITY_ORDER: DependencySeverity[] = ['critical', 'high', 'medium', 'low', 'unknown'];

export async function scanDependencyVulnerabilities(
  repositoryPath: string,
  options: DependencyScanOptions = {},
): Promise<DependencyScanReport> {
  const rootPath = resolve(repositoryPath);
  const rootStats = await stat(rootPath).catch(() => {
    throw new Error(`Ruta de repositorio inválida: ${repositoryPath}`);
  });

  if (!rootStats.isDirectory()) {
    throw new Error(`La ruta no es un directorio: ${repositoryPath}`);
  }

  const resolvedOptions = normalizeOptions(options);
  const manifests = await findDependencyManifests(rootPath, resolvedOptions.maxDepth);
  const targetsByScanner = buildScannerTargets(rootPath, manifests);

  const scanners: DependencyScannerResult[] = [];
  for (const scanner of SUPPORTED_DEPENDENCY_SCANNERS) {
    const targets = targetsByScanner[scanner];
    if (targets.length === 0) {
      scanners.push({
        scanner,
        status: 'skipped',
        targets: [],
        executions: [],
        findings: [],
        warnings: [],
      });
      continue;
    }

    scanners.push(await runScanner(rootPath, scanner, targets, resolvedOptions.runner, resolvedOptions));
  }

  const findings = scanners.flatMap((scanner) => scanner.findings).sort(compareFindings);
  const warnings = scanners.flatMap((scanner) => scanner.warnings);

  return {
    rootPath,
    generatedAt: new Date().toISOString(),
    scanners,
    findings,
    warnings,
    summary: buildSummary(scanners, findings),
  };
}

export const createLocalCommandRunner = (): DependencyCommandRunner => {
  return async (request) => {
    return new Promise<DependencyCommandResult>((resolveResult, rejectResult) => {
      const child = spawn(request.command, request.args, {
        cwd: request.cwd,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';
      let totalBytes = 0;
      let timedOut = false;
      let outputLimitExceeded = false;
      let settled = false;

      const finish = (result: DependencyCommandResult) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutHandle);
        resolveResult(result);
      };

      const fail = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutHandle);
        rejectResult(error);
      };

      const appendChunk = (destination: 'stdout' | 'stderr', chunk: Buffer) => {
        if (outputLimitExceeded) {
          return;
        }

        const remainingBytes = request.maxOutputBytes - totalBytes;
        if (remainingBytes <= 0) {
          outputLimitExceeded = true;
          child.kill();
          return;
        }

        const nextChunk = chunk.byteLength > remainingBytes ? chunk.subarray(0, remainingBytes) : chunk;
        totalBytes += nextChunk.byteLength;

        if (destination === 'stdout') {
          stdout += nextChunk.toString('utf8');
        } else {
          stderr += nextChunk.toString('utf8');
        }

        if (nextChunk.byteLength < chunk.byteLength) {
          outputLimitExceeded = true;
          child.kill();
        }
      };

      child.stdout?.on('data', (chunk: Buffer) => appendChunk('stdout', chunk));
      child.stderr?.on('data', (chunk: Buffer) => appendChunk('stderr', chunk));
      child.on('error', fail);
      child.on('close', (exitCode) => {
        finish({
          exitCode,
          stdout,
          stderr,
          timedOut,
          outputLimitExceeded,
        });
      });

      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, request.timeoutMs);
    });
  };
};

async function runScanner(
  rootPath: string,
  scanner: DependencyScannerName,
  targets: ScannerTarget[],
  runner: DependencyCommandRunner,
  options: Required<DependencyScanOptions>,
): Promise<DependencyScannerResult> {
  const executions: DependencyExecution[] = [];
  const findings: DependencyFinding[] = [];
  const warnings: DependencyWarning[] = [];

  for (const target of targets) {
    const request = buildCommandRequest(rootPath, scanner, target, options);

    try {
      const result = await runner(request);
      const execution = parseExecutionResult(rootPath, request, result);
      executions.push(execution);
      findings.push(...execution.findings);
      warnings.push(...execution.warnings);
    } catch (error) {
      if (isToolUnavailableError(error)) {
        const unavailableWarning = createWarning(scanner, 'tool_unavailable', `La herramienta ${request.command} no está disponible localmente.`, target.manifestPath);
        const unavailableExecution: DependencyExecution = {
          scanner,
          status: 'unavailable',
          command: [request.command, ...request.args],
          cwd: request.cwd,
          target: request.target,
          findings: [],
          warnings: [unavailableWarning],
        };

        executions.push(unavailableExecution);
        warnings.push(unavailableWarning);

        return {
          scanner,
          status: 'unavailable',
          targets: targets.map((item) => toRelativePath(rootPath, item.manifestPath)),
          executions,
          findings,
          warnings,
        };
      }

      const output = sanitizeCommandOutput(error instanceof Error ? error.message : String(error));
      const failureWarning = createWarning(
        scanner,
        'command_failed',
        `La ejecución de ${request.command} falló antes de producir una salida estructurada.`,
        target.manifestPath,
        output,
      );

      const failedExecution: DependencyExecution = {
        scanner,
        status: 'failed',
        command: [request.command, ...request.args],
        cwd: request.cwd,
        target: request.target,
        findings: [],
        warnings: [failureWarning],
      };

      executions.push(failedExecution);
      warnings.push(failureWarning);
    }
  }

  return {
    scanner,
    status: resolveScannerStatus(executions),
    targets: targets.map((item) => toRelativePath(rootPath, item.manifestPath)),
    executions,
    findings,
    warnings,
  };
}

function parseExecutionResult(
  rootPath: string,
  request: DependencyCommandRequest,
  result: DependencyCommandResult,
): DependencyExecution {
  if (result.timedOut) {
    const code: DependencyWarningCode = result.outputLimitExceeded ? 'output_limit_exceeded' : 'command_timed_out';
    const message = result.outputLimitExceeded
      ? `La salida de ${request.command} excedió el límite configurado y se truncó la ejecución.`
      : `La ejecución de ${request.command} superó el tiempo máximo configurado.`;

    return {
      scanner: request.scanner,
      status: 'failed',
      command: [request.command, ...request.args],
      cwd: request.cwd,
      target: request.target,
      findings: [],
      warnings: [createWarning(request.scanner, code, message, request.target, combinedOutput(result))],
    };
  }

  const parserContext: ParserContext = {
    rootPath,
    manifestPath: toRelativePath(rootPath, request.target),
    scanner: request.scanner,
  };

  const findings = parseScannerOutput(request.scanner, result.stdout, parserContext);
  if (findings) {
    return {
      scanner: request.scanner,
      status: 'completed',
      command: [request.command, ...request.args],
      cwd: request.cwd,
      target: request.target,
      findings,
      warnings: [],
    };
  }

  const warningCode: DependencyWarningCode = result.exitCode === 0 ? 'invalid_output' : 'invalid_output';
  const message =
    result.exitCode === 0
      ? `La salida de ${request.command} no tuvo el formato esperado para ${request.scanner}.`
      : `La salida de ${request.command} no pudo interpretarse para ${request.scanner} (exit code ${String(result.exitCode)}).`;

  return {
    scanner: request.scanner,
    status: 'failed',
    command: [request.command, ...request.args],
    cwd: request.cwd,
    target: request.target,
    findings: [],
    warnings: [createWarning(request.scanner, warningCode, message, request.target, combinedOutput(result))],
  };
}

function parseScannerOutput(
  scanner: DependencyScannerName,
  stdout: string,
  context: ParserContext,
): DependencyFinding[] | null {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    return [];
  }

  switch (scanner) {
    case 'npm':
      return parseNpmOutput(trimmed, context);
    case 'pip-audit':
      return parsePipAuditOutput(trimmed, context);
    case 'cargo-audit':
      return parseCargoAuditOutput(trimmed, context);
    case 'dotnet':
      return parseDotnetOutput(trimmed, context);
    case 'osv-scanner':
      return parseOsvOutput(trimmed, context);
    default:
      return null;
  }
}

function parseNpmOutput(stdout: string, context: ParserContext): DependencyFinding[] | null {
  const payload = parseJson(stdout);
  if (!isRecord(payload)) {
    return null;
  }

  const vulnerabilities = payload.vulnerabilities;
  if (!isRecord(vulnerabilities)) {
    return [];
  }

  const findings: DependencyFinding[] = [];
  for (const [packageName, entry] of Object.entries(vulnerabilities)) {
    if (!isRecord(entry)) {
      continue;
    }

    const advisories = Array.isArray(entry.via) ? entry.via.filter(isRecord) : [];
    const fixedVersion = extractNpmFixedVersion(entry.fixAvailable);

    if (advisories.length === 0) {
      findings.push(
        finalizeFinding(context, {
          ecosystem: 'npm',
          packageName,
          severity: normalizeSeverity(entry.severity),
          summary: `Vulnerabilidad reportada por npm audit para ${packageName}.`,
          advisoryId: undefined,
          advisoryUrl: undefined,
          installedVersion: asOptionalString(entry.range),
          fixedVersion,
          direct: asOptionalBoolean(entry.isDirect),
        }),
      );
      continue;
    }

    for (const advisory of advisories) {
      const source = advisory.source;
      findings.push(
        finalizeFinding(context, {
          ecosystem: 'npm',
          packageName,
          severity: normalizeSeverity(advisory.severity ?? entry.severity),
          summary: asOptionalString(advisory.title) ?? `Vulnerabilidad reportada por npm audit para ${packageName}.`,
          advisoryId: source === undefined ? undefined : String(source),
          advisoryUrl: asOptionalString(advisory.url),
          installedVersion: asOptionalString(entry.range),
          fixedVersion,
          direct: asOptionalBoolean(entry.isDirect),
        }),
      );
    }
  }

  return findings;
}

function parsePipAuditOutput(stdout: string, context: ParserContext): DependencyFinding[] | null {
  const payload = parseJson(stdout);
  const dependencies = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.dependencies)
      ? payload.dependencies
      : null;

  if (!dependencies) {
    return null;
  }

  const findings: DependencyFinding[] = [];
  for (const dependency of dependencies) {
    if (!isRecord(dependency) || !Array.isArray(dependency.vulns)) {
      continue;
    }

    const packageName = asOptionalString(dependency.name) ?? 'unknown';
    const installedVersion = asOptionalString(dependency.version);

    for (const vulnerability of dependency.vulns) {
      if (!isRecord(vulnerability)) {
        continue;
      }

      const fixVersions = Array.isArray(vulnerability.fix_versions) ? vulnerability.fix_versions.filter((value) => typeof value === 'string') : [];
      findings.push(
        finalizeFinding(context, {
          ecosystem: 'python',
          packageName,
          severity: 'unknown',
          summary: asOptionalString(vulnerability.description) ?? `Vulnerabilidad reportada por pip-audit para ${packageName}.`,
          advisoryId: asOptionalString(vulnerability.id) ?? firstString(vulnerability.aliases),
          advisoryUrl: undefined,
          installedVersion,
          fixedVersion: fixVersions[0],
          direct: undefined,
        }),
      );
    }
  }

  return findings;
}

function parseCargoAuditOutput(stdout: string, context: ParserContext): DependencyFinding[] | null {
  const payload = parseJson(stdout);
  if (!isRecord(payload) || !isRecord(payload.vulnerabilities) || !Array.isArray(payload.vulnerabilities.list)) {
    return null;
  }

  const findings: DependencyFinding[] = [];
  for (const item of payload.vulnerabilities.list) {
    if (!isRecord(item) || !isRecord(item.package) || !isRecord(item.advisory)) {
      continue;
    }

    const patchedVersions =
      isRecord(item.versions) && Array.isArray(item.versions.patched)
        ? item.versions.patched.filter((value) => typeof value === 'string')
        : [];

    findings.push(
      finalizeFinding(context, {
        ecosystem: 'cargo',
        packageName: asOptionalString(item.package.name) ?? 'unknown',
        severity: normalizeSeverity(extractCargoSeverity(item.advisory.cvss)),
        summary: asOptionalString(item.advisory.title) ?? 'Vulnerabilidad reportada por cargo audit.',
        advisoryId: asOptionalString(item.advisory.id),
        advisoryUrl: asOptionalString(item.advisory.url),
        installedVersion: asOptionalString(item.package.version),
        fixedVersion: patchedVersions[0],
        direct: undefined,
      }),
    );
  }

  return findings;
}

function parseDotnetOutput(stdout: string, context: ParserContext): DependencyFinding[] | null {
  const payload = parseJson(stdout);
  if (!isRecord(payload) || !Array.isArray(payload.projects)) {
    return null;
  }

  const findings: DependencyFinding[] = [];
  for (const project of payload.projects) {
    if (!isRecord(project) || !Array.isArray(project.frameworks)) {
      continue;
    }

    for (const framework of project.frameworks) {
      if (!isRecord(framework)) {
        continue;
      }

      const packageGroups = [framework.topLevelPackages, framework.transitivePackages];
      for (const packageGroup of packageGroups) {
        if (!Array.isArray(packageGroup)) {
          continue;
        }

        for (const packageEntry of packageGroup) {
          if (!isRecord(packageEntry) || !Array.isArray(packageEntry.vulnerabilities)) {
            continue;
          }

          const packageName = asOptionalString(packageEntry.id) ?? asOptionalString(packageEntry.name) ?? 'unknown';
          const installedVersion = asOptionalString(packageEntry.resolvedVersion) ?? asOptionalString(packageEntry.version);

          for (const vulnerability of packageEntry.vulnerabilities) {
            if (!isRecord(vulnerability)) {
              continue;
            }

            findings.push(
              finalizeFinding(context, {
                ecosystem: '.net',
                packageName,
                severity: normalizeSeverity(vulnerability.severity),
                summary: asOptionalString(vulnerability.advisoryTitle) ?? 'Vulnerabilidad reportada por dotnet.',
                advisoryId: undefined,
                advisoryUrl: asOptionalString(vulnerability.advisoryUrl),
                installedVersion,
                fixedVersion: asOptionalString(vulnerability.fixedVersion),
                direct: packageGroup === framework.topLevelPackages,
              }),
            );
          }
        }
      }
    }
  }

  return findings;
}

function parseOsvOutput(stdout: string, context: ParserContext): DependencyFinding[] | null {
  const payload = parseJson(stdout);
  if (!isRecord(payload) || !Array.isArray(payload.results)) {
    return null;
  }

  const findings: DependencyFinding[] = [];
  for (const result of payload.results) {
    if (!isRecord(result) || !Array.isArray(result.packages)) {
      continue;
    }

    const sourcePath = isRecord(result.source) ? asOptionalString(result.source.path) : undefined;

    for (const packageEntry of result.packages) {
      if (!isRecord(packageEntry) || !isRecord(packageEntry.package) || !Array.isArray(packageEntry.vulnerabilities)) {
        continue;
      }

      const packageName = asOptionalString(packageEntry.package.name) ?? 'unknown';
      const ecosystem = asOptionalString(packageEntry.package.ecosystem) ?? 'unknown';
      const installedVersion = asOptionalString(packageEntry.version);

      for (const vulnerability of packageEntry.vulnerabilities) {
        if (!isRecord(vulnerability)) {
          continue;
        }

        findings.push(
          finalizeFinding(
            {
              ...context,
              manifestPath: normalizeReferencedPath(context.rootPath, sourcePath) ?? context.manifestPath,
            },
            {
              ecosystem,
              packageName,
              severity: normalizeSeverity(extractOsvSeverity(vulnerability)),
              summary: asOptionalString(vulnerability.summary) ?? asOptionalString(vulnerability.details) ?? 'Vulnerabilidad reportada por osv-scanner.',
              advisoryId: asOptionalString(vulnerability.id),
              advisoryUrl: asOptionalString(vulnerability.url),
              installedVersion,
              fixedVersion: extractOsvFixedVersion(vulnerability),
              direct: undefined,
            },
          ),
        );
      }
    }
  }

  return findings;
}

async function findDependencyManifests(rootPath: string, maxDepth: number): Promise<ManifestBuckets> {
  const manifests: ManifestBuckets = {
    npm: [],
    pip: [],
    cargo: [],
    dotnet: [],
  };

  await walkForManifests(rootPath, rootPath, 0, maxDepth, manifests);

  manifests.npm.sort((left, right) => left.localeCompare(right, 'en'));
  manifests.pip.sort((left, right) => left.localeCompare(right, 'en'));
  manifests.cargo.sort((left, right) => left.localeCompare(right, 'en'));
  manifests.dotnet.sort((left, right) => left.localeCompare(right, 'en'));

  return manifests;
}

async function walkForManifests(
  rootPath: string,
  directoryPath: string,
  depth: number,
  maxDepth: number,
  manifests: ManifestBuckets,
): Promise<void> {
  if (depth > maxDepth) {
    return;
  }

  const entries = await readdir(directoryPath, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));

  for (const entry of entries) {
    const entryPath = resolve(directoryPath, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRECTORIES.has(entry.name.toLowerCase())) {
        continue;
      }
      await walkForManifests(rootPath, entryPath, depth + 1, maxDepth, manifests);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const lowerName = entry.name.toLowerCase();
    const lowerPath = entryPath.toLowerCase();

    if (lowerName === 'package.json' || lowerName === 'package-lock.json' || lowerName === 'npm-shrinkwrap.json') {
      manifests.npm.push(entryPath);
      continue;
    }

    if (
      lowerName === 'requirements.txt' ||
      lowerName.startsWith('requirements-') ||
      lowerName.endsWith('.requirements.txt') ||
      lowerName === 'pyproject.toml' ||
      lowerName === 'pipfile' ||
      lowerName === 'poetry.lock'
    ) {
      manifests.pip.push(entryPath);
      continue;
    }

    if (lowerName === 'cargo.lock' || lowerName === 'cargo.toml') {
      manifests.cargo.push(entryPath);
      continue;
    }

    if (lowerName.endsWith('.sln') || lowerPath.endsWith('.csproj') || lowerPath.endsWith('.fsproj') || lowerPath.endsWith('.vbproj')) {
      manifests.dotnet.push(entryPath);
    }
  }
}

function buildScannerTargets(
  rootPath: string,
  manifests: ManifestBuckets,
): Record<DependencyScannerName, ScannerTarget[]> {
  const npmTargets = selectPreferredManifestPerDirectory(manifests.npm, ['package-lock.json', 'npm-shrinkwrap.json', 'package.json']);
  const cargoTargets = selectPreferredManifestPerDirectory(manifests.cargo, ['Cargo.lock', 'Cargo.toml']);
  const dotnetTargets = selectDotnetTargets(manifests.dotnet);
  const pipTargets = manifests.pip.map((manifestPath) => ({
    manifestPath,
    cwd: rootPath,
  }));
  const hasAnyManifest =
    npmTargets.length > 0 || pipTargets.length > 0 || cargoTargets.length > 0 || dotnetTargets.length > 0;

  return {
    npm: npmTargets,
    'pip-audit': pipTargets,
    'cargo-audit': cargoTargets,
    dotnet: dotnetTargets,
    'osv-scanner': hasAnyManifest
      ? [
          {
            manifestPath: rootPath,
            cwd: rootPath,
          },
        ]
      : [],
  };
}

function selectPreferredManifestPerDirectory(paths: string[], preferenceOrder: string[]): ScannerTarget[] {
  const grouped = new Map<string, string>();
  const preference = new Map(preferenceOrder.map((name, index) => [name.toLowerCase(), index]));

  for (const manifestPath of paths) {
    const directory = dirname(manifestPath);
    const current = grouped.get(directory);
    if (!current) {
      grouped.set(directory, manifestPath);
      continue;
    }

    const currentScore = preference.get(basename(current).toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    const nextScore = preference.get(basename(manifestPath).toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    if (nextScore < currentScore) {
      grouped.set(directory, manifestPath);
    }
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([directory, manifestPath]) => ({
      manifestPath,
      cwd: directory,
    }));
}

function selectDotnetTargets(paths: string[]): ScannerTarget[] {
  const solutions = paths.filter((manifestPath) => manifestPath.toLowerCase().endsWith('.sln'));
  const targets = solutions.length > 0 ? solutions : paths;

  return targets
    .slice()
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map((manifestPath) => ({
      manifestPath,
      cwd: dirname(manifestPath),
    }));
}

function buildCommandRequest(
  rootPath: string,
  scanner: DependencyScannerName,
  target: ScannerTarget,
  options: Required<DependencyScanOptions>,
): DependencyCommandRequest {
  switch (scanner) {
    case 'npm':
      return {
        scanner,
        command: 'npm',
        args: ['audit', '--json'],
        cwd: target.cwd,
        target: target.manifestPath,
        timeoutMs: options.timeoutMs,
        maxOutputBytes: options.maxOutputBytes,
      };
    case 'pip-audit': {
      const lowerName = basename(target.manifestPath).toLowerCase();
      const args =
        lowerName === 'requirements.txt' || lowerName.startsWith('requirements-') || lowerName.endsWith('.requirements.txt')
          ? ['--format', 'json', '--requirement', target.manifestPath]
          : ['--format', 'json', '--path', dirname(target.manifestPath)];

      return {
        scanner,
        command: 'pip-audit',
        args,
        cwd: rootPath,
        target: target.manifestPath,
        timeoutMs: options.timeoutMs,
        maxOutputBytes: options.maxOutputBytes,
      };
    }
    case 'cargo-audit':
      return {
        scanner,
        command: 'cargo',
        args: ['audit', '--json'],
        cwd: target.cwd,
        target: target.manifestPath,
        timeoutMs: options.timeoutMs,
        maxOutputBytes: options.maxOutputBytes,
      };
    case 'dotnet':
      return {
        scanner,
        command: 'dotnet',
        args: ['list', target.manifestPath, 'package', '--vulnerable', '--include-transitive', '--format', 'json'],
        cwd: rootPath,
        target: target.manifestPath,
        timeoutMs: options.timeoutMs,
        maxOutputBytes: options.maxOutputBytes,
      };
    case 'osv-scanner':
      return {
        scanner,
        command: 'osv-scanner',
        args: ['--format', 'json', '--recursive', rootPath],
        cwd: rootPath,
        target: target.manifestPath,
        timeoutMs: options.timeoutMs,
        maxOutputBytes: options.maxOutputBytes,
      };
    default:
      return assertNever(scanner);
  }
}

function normalizeOptions(options: DependencyScanOptions): Required<DependencyScanOptions> {
  return {
    runner: options.runner ?? createLocalCommandRunner(),
    timeoutMs: normalizePositiveInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, 'timeoutMs'),
    maxOutputBytes: normalizePositiveInteger(options.maxOutputBytes, DEFAULT_MAX_OUTPUT_BYTES, 'maxOutputBytes'),
    maxDepth: normalizePositiveInteger(options.maxDepth, DEFAULT_MAX_DEPTH, 'maxDepth'),
  };
}

function buildSummary(scanners: DependencyScannerResult[], findings: DependencyFinding[]): DependencyScanSummary {
  const findingsBySeverity = Object.fromEntries(SEVERITY_ORDER.map((severity) => [severity, 0])) as Record<DependencySeverity, number>;
  const scannersByStatus = {
    completed: 0,
    failed: 0,
    unavailable: 0,
    skipped: 0,
  } satisfies Record<DependencyScannerStatus, number>;

  for (const finding of findings) {
    findingsBySeverity[finding.severity] += 1;
  }

  for (const scanner of scanners) {
    scannersByStatus[scanner.status] += 1;
  }

  return {
    totalFindings: findings.length,
    findingsBySeverity,
    scannersByStatus,
  };
}

function resolveScannerStatus(executions: DependencyExecution[]): DependencyScannerStatus {
  if (executions.length === 0) {
    return 'skipped';
  }
  if (executions.some((execution) => execution.status === 'completed')) {
    return 'completed';
  }
  if (executions.some((execution) => execution.status === 'unavailable')) {
    return 'unavailable';
  }
  return 'failed';
}

function finalizeFinding(context: ParserContext, finding: FindingDraft): DependencyFinding {
  return {
    id: buildFindingId(context.scanner, context.manifestPath, finding.packageName, finding.advisoryId ?? finding.summary),
    scanner: context.scanner,
    manifestPath: context.manifestPath,
    ...finding,
  };
}

function buildFindingId(scanner: DependencyScannerName, manifestPath: string, packageName: string, advisoryToken: string): string {
  return `${scanner}:${slugify(manifestPath)}:${slugify(packageName)}:${slugify(advisoryToken)}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function combinedOutput(result: DependencyCommandResult): string | undefined {
  const output = [result.stdout, result.stderr].filter((part) => part.trim().length > 0).join('\n');
  const sanitized = sanitizeCommandOutput(output);
  return sanitized.length > 0 ? sanitized : undefined;
}

function sanitizeCommandOutput(output: string): string {
  const redacted = output
    .replace(/(authorization\s*:\s*bearer\s+)[^\s]+/gi, '$1[REDACTED]')
    .replace(/(https?:\/\/)([^/\s:@]+):([^@\s/]+)@/gi, '$1[REDACTED]@')
    .replace(
      /(\b(?:token|secret|password|passwd|api[_-]?key|apikey|client[_-]?secret|authorization)\b\s*[:=]\s*)(['"]?)([^\s'"]+)(['"]?)/gi,
      (_match, prefix: string, leftQuote: string, _secret: string, rightQuote: string) => `${prefix}${leftQuote}[REDACTED]${rightQuote}`,
    )
    .replace(/\b(sk_(?:live|test)_[A-Za-z0-9]{8,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,})\b/g, '[REDACTED]');

  return shorten(redacted, OUTPUT_PREVIEW_LIMIT);
}

function extractNpmFixedVersion(value: unknown): string | undefined {
  if (typeof value === 'boolean' || value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (isRecord(value)) {
    return asOptionalString(value.version);
  }
  return undefined;
}

function extractCargoSeverity(value: unknown): string | number | undefined {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  if (isRecord(value)) {
    return asOptionalString(value.severity) ?? asOptionalNumber(value.score);
  }
  return undefined;
}

function extractOsvSeverity(vulnerability: Record<string, unknown>): string | number | undefined {
  const databaseSeverity = isRecord(vulnerability.database_specific) ? vulnerability.database_specific.severity : undefined;
  if (typeof databaseSeverity === 'string') {
    return databaseSeverity;
  }

  if (Array.isArray(vulnerability.severity)) {
    for (const entry of vulnerability.severity) {
      if (!isRecord(entry)) {
        continue;
      }
      const score = asOptionalNumber(entry.score);
      if (score !== undefined) {
        return score;
      }
      const textualScore = asOptionalString(entry.score);
      if (textualScore !== undefined) {
        return textualScore;
      }
    }
  }

  return undefined;
}

function extractOsvFixedVersion(vulnerability: Record<string, unknown>): string | undefined {
  if (!Array.isArray(vulnerability.affected)) {
    return undefined;
  }

  for (const affected of vulnerability.affected) {
    if (!isRecord(affected) || !Array.isArray(affected.ranges)) {
      continue;
    }

    for (const range of affected.ranges) {
      if (!isRecord(range) || !Array.isArray(range.events)) {
        continue;
      }

      for (const event of range.events) {
        if (!isRecord(event)) {
          continue;
        }
        const fixed = asOptionalString(event.fixed);
        if (fixed) {
          return fixed;
        }
      }
    }
  }

  return undefined;
}

function normalizeSeverity(value: unknown): DependencySeverity {
  if (typeof value === 'number') {
    if (value >= 9) {
      return 'critical';
    }
    if (value >= 7) {
      return 'high';
    }
    if (value >= 4) {
      return 'medium';
    }
    if (value > 0) {
      return 'low';
    }
    return 'unknown';
  }

  if (typeof value !== 'string') {
    return 'unknown';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'critical') {
    return 'critical';
  }
  if (normalized === 'high' || normalized === 'important') {
    return 'high';
  }
  if (normalized === 'medium' || normalized === 'moderate') {
    return 'medium';
  }
  if (normalized === 'low') {
    return 'low';
  }

  const numericScore = Number(normalized);
  return Number.isFinite(numericScore) ? normalizeSeverity(numericScore) : 'unknown';
}

function normalizeReferencedPath(rootPath: string, rawPath: string | undefined): string | undefined {
  if (!rawPath) {
    return undefined;
  }
  if (isAbsolute(rawPath)) {
    return toRelativePath(rootPath, rawPath);
  }
  return rawPath.split('\\').join('/');
}

function createWarning(
  scanner: DependencyScannerName,
  code: DependencyWarningCode,
  message: string,
  target?: string,
  output?: string,
): DependencyWarning {
  return {
    scanner,
    code,
    message,
    target: target ? target.split('\\').join('/') : undefined,
    output,
  };
}

function compareFindings(left: DependencyFinding, right: DependencyFinding): number {
  const severityDelta = SEVERITY_ORDER.indexOf(left.severity) - SEVERITY_ORDER.indexOf(right.severity);
  if (severityDelta !== 0) {
    return severityDelta;
  }
  const scannerDelta = left.scanner.localeCompare(right.scanner, 'en');
  if (scannerDelta !== 0) {
    return scannerDelta;
  }
  const manifestDelta = left.manifestPath.localeCompare(right.manifestPath, 'en');
  if (manifestDelta !== 0) {
    return manifestDelta;
  }
  return left.packageName.localeCompare(right.packageName, 'en');
}

function normalizePositiveInteger(value: number | undefined, fallback: number, name: string): number {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`La opción ${name} debe ser un entero positivo`);
  }
  return value;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function shorten(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

function isToolUnavailableError(error: unknown): boolean {
  return (
    error instanceof Error &&
    ('code' in error ? (error as NodeJS.ErrnoException).code === 'ENOENT' : false)
  );
}

function toRelativePath(rootPath: string, candidatePath: string): string {
  return relative(rootPath, candidatePath).split('\\').join('/');
}

function firstString(value: unknown): string | undefined {
  return Array.isArray(value) ? value.find((item): item is string => typeof item === 'string') : undefined;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function assertNever(value: never): never {
  throw new Error(`Scanner no soportado: ${String(value)}`);
}
