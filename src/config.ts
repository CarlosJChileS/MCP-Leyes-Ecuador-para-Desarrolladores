import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { AuditCategory, AuditOptions, AuditStatus } from './audit.js';

type FindingStatusConfig = {
  byId: Record<string, AuditStatus>;
  byRuleId: Record<string, AuditStatus>;
  byCategory: Partial<Record<AuditCategory, AuditStatus>>;
};

type ControlStatusConfig = {
  byId: Record<string, AuditStatus>;
  byCategory: Partial<Record<AuditCategory | 'general', AuditStatus>>;
};

export type AuditConfig = {
  limits: Partial<AuditOptions>;
  excludePaths: string[];
  statuses: {
    findings: FindingStatusConfig;
    controls: ControlStatusConfig;
  };
};

export type LoadedAuditConfig = {
  path: string;
  exists: boolean;
  warnings: string[];
  config: AuditConfig;
};

const VALID_STATUSES = new Set<AuditStatus>(['cumple', 'no cumple', 'no aplica', 'pendiente']);
const VALID_FINDING_CATEGORIES = new Set<AuditCategory>([
  'secretos',
  'datos_personales',
  'logs_sensibles',
  'transporte_inseguro',
  'cors',
  'cookies',
  'endpoints_sensibles',
  'infraestructura',
  'documentacion',
]);
const VALID_CONTROL_CATEGORIES = new Set<AuditCategory | 'general'>(['general', ...VALID_FINDING_CATEGORIES]);

export async function loadAuditConfig(repositoryPath: string): Promise<LoadedAuditConfig> {
  const configPath = join(resolve(repositoryPath), '.mcp-audit.json');

  let raw: string;
  try {
    raw = await readFile(configPath, 'utf8');
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        path: configPath,
        exists: false,
        warnings: [],
        config: createEmptyAuditConfig(),
      };
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      path: configPath,
      exists: true,
      warnings: ['.mcp-audit.json no contiene JSON válido; se usarán valores por defecto.'],
      config: createEmptyAuditConfig(),
    };
  }

  const warnings: string[] = [];
  const config = createEmptyAuditConfig();

  if (!isPlainObject(parsed)) {
    warnings.push('.mcp-audit.json debe ser un objeto JSON; se usarán valores por defecto.');
    return {
      path: configPath,
      exists: true,
      warnings,
      config,
    };
  }

  if ('limits' in parsed) {
    if (isPlainObject(parsed.limits)) {
      config.limits.maxDepth = readPositiveInteger(parsed.limits.maxDepth, 'limits.maxDepth', warnings);
      config.limits.maxFiles = readPositiveInteger(parsed.limits.maxFiles, 'limits.maxFiles', warnings);
      config.limits.maxFileSizeBytes = readPositiveInteger(parsed.limits.maxFileSizeBytes, 'limits.maxFileSizeBytes', warnings);
      removeUndefinedEntries(config.limits);
    } else {
      warnings.push('limits debe ser un objeto.');
    }
  }

  if ('excludePaths' in parsed) {
    if (Array.isArray(parsed.excludePaths) && parsed.excludePaths.every((value) => typeof value === 'string' && value.trim() !== '')) {
      config.excludePaths = parsed.excludePaths.map((value) => value.trim());
    } else {
      warnings.push('excludePaths debe ser un arreglo de strings no vacíos.');
    }
  }

  if ('statuses' in parsed) {
    if (isPlainObject(parsed.statuses)) {
      config.statuses.findings = readFindingStatuses(parsed.statuses.findings, warnings);
      config.statuses.controls = readControlStatuses(parsed.statuses.controls, warnings);
    } else {
      warnings.push('statuses debe ser un objeto.');
    }
  }

  return {
    path: configPath,
    exists: true,
    warnings,
    config,
  };
}

function createEmptyAuditConfig(): AuditConfig {
  return {
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
  };
}

function readFindingStatuses(value: unknown, warnings: string[]): FindingStatusConfig {
  if (!isPlainObject(value)) {
    if (value !== undefined) {
      warnings.push('statuses.findings debe ser un objeto.');
    }
    return {
      byId: {},
      byRuleId: {},
      byCategory: {},
    };
  }

  return {
    byId: readStatusRecord(value.byId, 'statuses.findings.byId', warnings),
    byRuleId: readStatusRecord(value.byRuleId, 'statuses.findings.byRuleId', warnings),
    byCategory: readStatusCategoryRecord(value.byCategory, 'statuses.findings.byCategory', VALID_FINDING_CATEGORIES, warnings),
  };
}

function readControlStatuses(value: unknown, warnings: string[]): ControlStatusConfig {
  if (!isPlainObject(value)) {
    if (value !== undefined) {
      warnings.push('statuses.controls debe ser un objeto.');
    }
    return {
      byId: {},
      byCategory: {},
    };
  }

  return {
    byId: readStatusRecord(value.byId, 'statuses.controls.byId', warnings),
    byCategory: readStatusCategoryRecord(value.byCategory, 'statuses.controls.byCategory', VALID_CONTROL_CATEGORIES, warnings),
  };
}

function readStatusRecord(value: unknown, path: string, warnings: string[]): Record<string, AuditStatus> {
  if (value === undefined) {
    return {};
  }
  if (!isPlainObject(value)) {
    warnings.push(`${path} debe ser un objeto.`);
    return {};
  }

  const result: Record<string, AuditStatus> = {};
  for (const [key, status] of Object.entries(value)) {
    const parsedStatus = readStatus(status, `${path}.${key}`, warnings);
    if (parsedStatus) {
      result[key] = parsedStatus;
    }
  }
  return result;
}

function readStatusCategoryRecord<TCategory extends string>(
  value: unknown,
  path: string,
  allowedCategories: ReadonlySet<TCategory>,
  warnings: string[],
): Partial<Record<TCategory, AuditStatus>> {
  if (value === undefined) {
    return {};
  }
  if (!isPlainObject(value)) {
    warnings.push(`${path} debe ser un objeto.`);
    return {};
  }

  const result: Partial<Record<TCategory, AuditStatus>> = {};
  for (const [category, status] of Object.entries(value)) {
    if (!allowedCategories.has(category as TCategory)) {
      warnings.push(`${path}.${category} no es una categoría soportada.`);
      continue;
    }
    const parsedStatus = readStatus(status, `${path}.${category}`, warnings);
    if (parsedStatus) {
      result[category as TCategory] = parsedStatus;
    }
  }
  return result;
}

function readStatus(value: unknown, path: string, warnings: string[]): AuditStatus | undefined {
  if (typeof value === 'string' && VALID_STATUSES.has(value as AuditStatus)) {
    return value as AuditStatus;
  }
  warnings.push(`${path} debe ser uno de: cumple, no cumple, no aplica, pendiente.`);
  return undefined;
}

function readPositiveInteger(value: unknown, path: string, warnings: string[]): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  warnings.push(`${path} debe ser un entero positivo.`);
  return undefined;
}

function removeUndefinedEntries(record: Partial<AuditOptions>) {
  for (const key of Object.keys(record) as (keyof AuditOptions)[]) {
    if (record[key] === undefined) {
      delete record[key];
    }
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
