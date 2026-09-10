import { describe, expect, it, vi } from 'vitest';
import { LegalCatalog } from '../src/catalog.js';
import { createServer } from '../src/server.js';
import type { AuditReport } from '../src/audit.js';
import type { DependencyScanReport } from '../src/dependencies.js';

const auditReportFixture: AuditReport = {
  summary: {
    repository: 'demo-repo',
    rootPath: 'C:/demo-repo',
    generatedAt: '2026-08-29T00:00:00.000Z',
    scannedFiles: 4,
    scannedDirectories: 2,
    skippedEntries: 1,
    totalFindings: 1,
    languages: {
      typescript: 2,
    },
    findingsBySeverity: {
      critical: 0,
      high: 1,
      medium: 0,
      low: 0,
    },
    findingsByCategory: {
      secretos: 1,
      datos_personales: 0,
      logs_sensibles: 0,
      transporte_inseguro: 0,
      cors: 0,
      cookies: 0,
      endpoints_sensibles: 0,
      infraestructura: 0,
      documentacion: 0,
    },
    limits: {
      maxDepth: 6,
      maxFiles: 500,
      maxFileSizeBytes: 262144,
    },
  },
  findings: [
    {
      id: 'secret-exposed:src/app.ts:7',
      ruleId: 'secret-exposed',
      severity: 'high',
      category: 'secretos',
      language: 'typescript',
      path: 'src/app.ts',
      line: 7,
      explanation: 'Se detectó un posible secreto o credencial incrustada en código o configuración.',
      evidence: 'const apiKey = "[REDACTED]";',
      recommendation: 'Mueva el valor a un gestor de secretos.',
      reference: {
        id: 'lopdp',
        title: 'Ley Orgánica de Protección de Datos Personales',
        url: 'https://example.test/lopdp',
        verifiedAt: '2026-08-27',
        status: 'vigente',
        topic: 'datos personales',
        rationale: 'Referencia principal.',
      },
      status: 'pendiente',
    },
  ],
  controls: [
    {
      id: 'control-secretos',
      category: 'secretos',
      title: 'Gestionar secretos fuera del repositorio',
      description: 'Centralizar credenciales y rotarlas.',
      referenceIds: ['lopdp'],
      status: 'pendiente',
    },
  ],
  references: [
    {
      id: 'lopdp',
      title: 'Ley Orgánica de Protección de Datos Personales',
      url: 'https://example.test/lopdp',
      verifiedAt: '2026-08-27',
      status: 'vigente',
      topic: 'datos personales',
      rationale: 'Referencia principal.',
    },
  ],
  disclaimer: 'Orientación preliminar.',
};

const dependencyReportFixture: DependencyScanReport = {
  rootPath: 'C:/demo-repo',
  generatedAt: '2026-08-29T00:00:01.000Z',
  scanners: [
    {
      scanner: 'npm',
      status: 'completed',
      targets: ['package-lock.json'],
      executions: [],
      findings: [
        {
          id: 'npm:package-lock-json:lodash:ghsa-demo',
          scanner: 'npm',
          ecosystem: 'npm',
          packageName: 'lodash',
          severity: 'critical',
          summary: 'Prototype pollution',
          manifestPath: 'package-lock.json',
          installedVersion: '4.17.20',
          fixedVersion: '4.17.21',
          advisoryId: 'GHSA-demo',
          advisoryUrl: 'https://example.test/ghsa-demo',
          direct: true,
        },
      ],
      warnings: [
        {
          scanner: 'npm',
          code: 'tool_unavailable',
          message: 'npm no está disponible',
          target: 'package-lock.json',
        },
      ],
    },
  ],
  findings: [
    {
      id: 'npm:package-lock-json:lodash:ghsa-demo',
      scanner: 'npm',
      ecosystem: 'npm',
      packageName: 'lodash',
      severity: 'critical',
      summary: 'Prototype pollution',
      manifestPath: 'package-lock.json',
      installedVersion: '4.17.20',
      fixedVersion: '4.17.21',
      advisoryId: 'GHSA-demo',
      advisoryUrl: 'https://example.test/ghsa-demo',
      direct: true,
    },
  ],
  warnings: [
    {
      scanner: 'npm',
      code: 'tool_unavailable',
      message: 'npm no está disponible',
      target: 'package-lock.json',
    },
  ],
  summary: {
    totalFindings: 1,
    findingsBySeverity: {
      critical: 1,
      high: 0,
      medium: 0,
      low: 0,
      unknown: 0,
    },
    scannersByStatus: {
      completed: 1,
      failed: 0,
      unavailable: 0,
      skipped: 0,
    },
  },
};

function getRegisteredAuditTool(server: any) {
  return server._registeredTools.auditar_repositorio;
}

function getAuditToolSchema(server: any) {
  return getRegisteredAuditTool(server).inputSchema['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
}

function getTextContent(result: any): string {
  return result.content[0].text;
}

describe('MCP server contract', () => {
  it('registers all tools, resources and reusable prompt', async () => {
    const server = createServer(await LegalCatalog.load()) as any;

    expect(Object.keys(server._registeredTools)).toEqual(expect.arrayContaining([
      'buscar_normativa',
      'consultar_obligacion',
      'verificar_vigencia',
      'evaluar_proyecto',
      'generar_checklist_auditoria',
      'generar_informe_gobernanza',
      'auditar_repositorio',
    ]));
    expect(Object.keys(server._registeredResources)).toContain('legal://normativa');
    expect(Object.keys(server._registeredResourceTemplates)).toContain('ficha-normativa');
    expect(Object.keys(server._registeredPrompts)).toContain('revision-privacidad');
  });

  it.each([
    ['markdown', '# Informe de gobernanza de datos: API ciudadana'],
    ['html', '<!DOCTYPE html>'],
  ])('exports the consolidated governance report as %s', async (format, expectedPrefix) => {
    const server = createServer(await LegalCatalog.load()) as any;
    const result = await server._registeredTools.generar_informe_gobernanza.executor({
      name: 'API ciudadana',
      dataTypes: ['cédula'],
      format,
    }, {} as any);
    expect(getTextContent(result).startsWith(expectedPrefix)).toBe(true);
  });

  it('exports the consolidated governance PDF as an encoded MCP attachment', async () => {
    const server = createServer(await LegalCatalog.load()) as any;
    const result = await server._registeredTools.generar_informe_gobernanza.executor({
      name: 'API ciudadana',
      format: 'pdf',
    }, {} as any);
    const attachment = JSON.parse(getTextContent(result));
    expect(attachment).toMatchObject({
      fileName: 'informe-gobernanza-api-ciudadana.pdf',
      mimeType: 'application/pdf',
      encoding: 'base64',
    });
    expect(Buffer.from(attachment.data, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('scans the requested repository and embeds technical findings in the governance report', async () => {
    const auditRepository = vi.fn().mockResolvedValue(auditReportFixture);
    const scanDependencyVulnerabilities = vi.fn().mockResolvedValue(dependencyReportFixture);
    const server = createServer(await LegalCatalog.load(), { auditRepository, scanDependencyVulnerabilities }) as any;
    const result = await server._registeredTools.generar_informe_gobernanza.executor({
      name: 'API ciudadana',
      repositoryPath: 'C:/demo-repo',
      maxDepth: 12,
      maxFiles: 2000,
      maxFileSizeBytes: 1048576,
      dependencyScan: true,
      timeout: 120000,
      format: 'json',
    }, {} as any);
    const report = JSON.parse(getTextContent(result));

    expect(auditRepository).toHaveBeenCalledWith('C:/demo-repo', { maxDepth: 12, maxFiles: 2000, maxFileSizeBytes: 1048576 });
    expect(scanDependencyVulnerabilities).toHaveBeenCalledWith('C:/demo-repo', { timeoutMs: 120000 });
    expect(report.sections.technicalAudit.summary).toMatchObject({ scannedFiles: 4, totalFindings: 1 });
    expect(report.sections.dependencyAudit.summary.totalFindings).toBe(1);
    expect(report.remediationPlan).toEqual(expect.arrayContaining([
      expect.objectContaining({ area: 'Código y seguridad: secret-exposed', problem: expect.stringContaining('src/app.ts:7') }),
      expect.objectContaining({ area: 'Dependencias: lodash', problem: expect.stringContaining('4.17.20') }),
    ]));
  });

  it('exposes the extended repository audit schema without breaking the previous input', async () => {
    const server = createServer(await LegalCatalog.load()) as any;
    const schema = getAuditToolSchema(server);

    expect(schema.required).toEqual(['path']);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties).toMatchObject({
      path: expect.objectContaining({ type: 'string' }),
      maxDepth: expect.objectContaining({ type: 'integer' }),
      maxFiles: expect.objectContaining({ type: 'integer' }),
      maxFileSizeBytes: expect.objectContaining({ type: 'integer' }),
      dependencyScan: expect.objectContaining({ type: 'boolean' }),
      timeout: expect.objectContaining({ type: 'integer' }),
      format: expect.objectContaining({ enum: ['json', 'markdown', 'html', 'sarif'] }),
    });
  });

  it('returns rendered JSON by default and skips dependency scan when not requested', async () => {
    const auditRepository = vi.fn().mockResolvedValue(auditReportFixture);
    const scanDependencyVulnerabilities = vi.fn().mockResolvedValue(dependencyReportFixture);
    const server = createServer(await LegalCatalog.load(), {
      auditRepository,
      scanDependencyVulnerabilities,
    }) as any;

    const result = await getRegisteredAuditTool(server).executor({ path: 'C:/demo-repo' }, {} as any);
    const payload = JSON.parse(getTextContent(result));

    expect(auditRepository).toHaveBeenCalledWith('C:/demo-repo', {
      maxDepth: undefined,
      maxFiles: undefined,
      maxFileSizeBytes: undefined,
    });
    expect(scanDependencyVulnerabilities).not.toHaveBeenCalled();
    expect(payload.repository).toEqual({
      name: 'demo-repo',
      rootPath: 'C:/demo-repo',
    });
    expect(payload.dependencyScan.enabled).toBe(false);
    expect(payload.disclaimer).toContain('Orientación preliminar');
  });

  it.each([
    ['markdown', '# Reporte de auditoria: demo-repo'],
    ['html', '<!DOCTYPE html>'],
  ])('runs dependency scan on demand and renders %s output', async (format, expectedPrefix) => {
    const auditRepository = vi.fn().mockResolvedValue(auditReportFixture);
    const scanDependencyVulnerabilities = vi.fn().mockResolvedValue(dependencyReportFixture);
    const server = createServer(await LegalCatalog.load(), {
      auditRepository,
      scanDependencyVulnerabilities,
    }) as any;

    const result = await getRegisteredAuditTool(server).executor(
      {
        path: 'C:/demo-repo',
        format,
        dependencyScan: true,
        timeout: 4321,
      },
      {} as any,
    );
    const text = getTextContent(result);

    expect(scanDependencyVulnerabilities).toHaveBeenCalledWith('C:/demo-repo', {
      timeoutMs: 4321,
    });
    expect(text.startsWith(expectedPrefix)).toBe(true);
    expect(text).toContain('lodash');
    expect(text).toContain('npm no está disponible');
  });
});
