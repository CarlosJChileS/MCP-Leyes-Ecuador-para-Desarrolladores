import { describe, expect, it } from 'vitest';
import type { AuditReport } from '../src/audit.js';
import type { DependencyScanReport } from '../src/dependencies.js';
import {
  renderAuditReportHtml,
  renderAuditReportJson,
  renderAuditReportMarkdown,
  type ReportSkippedCheck,
} from '../src/reports.js';

const auditReport: AuditReport = {
  summary: {
    repository: 'demo-repo',
    rootPath: '/tmp/demo-repo',
    generatedAt: '2026-08-29T12:00:00.000Z',
    scannedFiles: 4,
    scannedDirectories: 3,
    skippedEntries: 2,
    totalFindings: 2,
    languages: {
      python: 1,
      typescript: 2,
    },
    findingsBySeverity: {
      critical: 0,
      high: 1,
      medium: 1,
      low: 0,
    },
    findingsByCategory: {
      secretos: 1,
      datos_personales: 0,
      logs_sensibles: 0,
      transporte_inseguro: 1,
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
      id: 'insecure-http:src/zeta.ts:19',
      ruleId: 'insecure-http',
      severity: 'medium',
      category: 'transporte_inseguro',
      language: 'typescript',
      path: 'src/zeta.ts',
      line: 19,
      explanation: 'Se detecto transporte inseguro.',
      evidence: 'fetch("http://api.example.com/<admin>")',
      recommendation: 'Use HTTPS.',
      status: 'pendiente',
      reference: {
        id: 'comercio-electronico',
        title: 'Ley de Comercio Electronico',
        url: 'https://example.test/comercio',
        verifiedAt: '2026-08-27',
        status: 'reformado',
        topic: 'seguridad de servicios digitales',
        rationale: 'Controles de transporte seguro.',
      },
    },
    {
      id: 'secret-exposed:src/alpha.ts:4',
      ruleId: 'secret-exposed',
      severity: 'high',
      category: 'secretos',
      language: 'typescript',
      path: 'src/alpha.ts',
      line: 4,
      explanation: 'Se detecto un secreto.',
      evidence: 'const API_KEY = "[REDACTED]";',
      recommendation: 'Rote la credencial.',
      status: 'no cumple',
      reference: {
        id: 'lopdp',
        title: 'Ley de Proteccion de Datos Personales',
        url: 'https://example.test/lopdp',
        verifiedAt: '2026-08-27',
        status: 'vigente',
        topic: 'datos personales',
        rationale: 'Base general de privacidad.',
      },
    },
  ],
  controls: [
    {
      id: 'control-transporte',
      category: 'transporte_inseguro',
      title: 'Forzar transporte seguro',
      description: 'Eliminar integraciones HTTP en produccion.',
      referenceIds: ['comercio-electronico'],
      status: 'pendiente',
    },
    {
      id: 'control-general',
      category: 'general',
      title: 'Revisar alcance',
      description: 'Validar alcance y evidencia.',
      referenceIds: ['lopdp', 'comercio-electronico'],
      status: 'cumple',
    },
    {
      id: 'control-secretos',
      category: 'secretos',
      title: 'Gestionar secretos',
      description: 'Sacar secretos del repositorio.',
      referenceIds: ['lopdp'],
      status: 'no cumple',
    },
  ],
  references: [
    {
      id: 'lopdp',
      title: 'Ley de Proteccion de Datos Personales',
      url: 'https://example.test/lopdp',
      verifiedAt: '2026-08-27',
      status: 'vigente',
      topic: 'datos personales',
      rationale: 'Base general de privacidad.',
    },
    {
      id: 'comercio-electronico',
      title: 'Ley de Comercio Electronico',
      url: 'https://example.test/comercio',
      verifiedAt: '2026-08-27',
      status: 'reformado',
      topic: 'seguridad de servicios digitales',
      rationale: 'Controles de transporte seguro.',
    },
  ],
  disclaimer: 'Orientacion preliminar y tecnica.',
};

const dependencyScan: DependencyScanReport = {
  rootPath: '/tmp/demo-repo',
  generatedAt: '2026-08-29T12:00:00.000Z',
  scanners: [
    {
      scanner: 'osv-scanner',
      status: 'skipped',
      targets: [],
      executions: [],
      findings: [],
      warnings: [],
    },
    {
      scanner: 'pip-audit',
      status: 'unavailable',
      targets: ['api/requirements.txt'],
      executions: [],
      findings: [],
      warnings: [
        {
          scanner: 'pip-audit',
          code: 'tool_unavailable',
          message: 'La herramienta pip-audit no esta disponible localmente.',
          target: 'api/requirements.txt',
        },
      ],
    },
    {
      scanner: 'npm',
      status: 'completed',
      targets: ['web/package-lock.json'],
      executions: [],
      findings: [
        {
          id: 'npm:web-package-lock-json:minimatch:ghsa',
          scanner: 'npm',
          ecosystem: 'npm',
          packageName: 'minimatch',
          severity: 'critical',
          summary: 'Regular expression denial of service',
          manifestPath: 'web/package-lock.json',
          installedVersion: '3.0.0',
          fixedVersion: '3.0.5',
          advisoryId: 'GHSA-f8q6-p94x-37v3',
          advisoryUrl: 'https://github.com/advisories/GHSA-f8q6-p94x-37v3',
          direct: true,
        },
      ],
      warnings: [],
    },
  ],
  findings: [
    {
      id: 'cargo:native-cargo-lock:time:rustsec',
      scanner: 'cargo-audit',
      ecosystem: 'cargo',
      packageName: 'time',
      severity: 'low',
      summary: 'Potential issue in time crate',
      manifestPath: 'native/Cargo.lock',
      installedVersion: '0.1.0',
      fixedVersion: '0.2.23',
      advisoryId: 'RUSTSEC-2020-0159',
      advisoryUrl: 'https://rustsec.org/advisories/RUSTSEC-2020-0159.html',
    },
    {
      id: 'npm:web-package-lock-json:minimatch:ghsa',
      scanner: 'npm',
      ecosystem: 'npm',
      packageName: 'minimatch',
      severity: 'critical',
      summary: 'Regular expression denial of service',
      manifestPath: 'web/package-lock.json',
      installedVersion: '3.0.0',
      fixedVersion: '3.0.5',
      advisoryId: 'GHSA-f8q6-p94x-37v3',
      advisoryUrl: 'https://github.com/advisories/GHSA-f8q6-p94x-37v3',
      direct: true,
    },
  ],
  warnings: [
    {
      scanner: 'pip-audit',
      code: 'tool_unavailable',
      message: 'La herramienta pip-audit no esta disponible localmente.',
      target: 'api/requirements.txt',
    },
  ],
  summary: {
    totalFindings: 2,
    findingsBySeverity: {
      critical: 1,
      high: 0,
      medium: 0,
      low: 1,
      unknown: 0,
    },
    scannersByStatus: {
      completed: 1,
      failed: 0,
      unavailable: 1,
      skipped: 1,
    },
  },
};

const skippedChecks: ReportSkippedCheck[] = [
  {
    id: 'terraform-state',
    title: 'Estado Terraform',
    reason: 'No se detectaron archivos .tf.',
  },
  {
    id: 'docker-base-image',
    title: 'Imagen base Docker',
    reason: 'No se detecto Dockerfile.',
  },
];

describe('report renderers', () => {
  it('renders deterministic JSON with executive summary, risk level and dependency status', () => {
    const rendered = renderAuditReportJson(auditReport, {
      dependencyScan,
      skippedChecks,
    });

    expect(rendered).toBe(
      JSON.stringify(
        {
          schemaVersion: 1,
          generatedAt: '2026-08-29T12:00:00.000Z',
          repository: {
            name: 'demo-repo',
            rootPath: '/tmp/demo-repo',
          },
          riskLevel: 'critical',
          riskScore: 68,
          remediationPriority: 'inmediata',
          executiveSummary: {
            headline: 'Se detectaron 4 hallazgos: 2 de auditoria local y 2 de dependencias.',
            totalFindings: 4,
            totalAuditFindings: 2,
            totalDependencyFindings: 2,
            scannedFiles: 4,
            scannedDirectories: 3,
            skippedEntries: 2,
            skippedChecks: 2,
            dependencyWarnings: 1,
          },
          summary: {
            repository: 'demo-repo',
            rootPath: '/tmp/demo-repo',
            generatedAt: '2026-08-29T12:00:00.000Z',
            scannedFiles: 4,
            scannedDirectories: 3,
            skippedEntries: 2,
            totalFindings: 2,
            languages: {
              python: 1,
              typescript: 2,
            },
            findingsBySeverity: {
              critical: 0,
              high: 1,
              medium: 1,
              low: 0,
            },
            findingsByCategory: {
              secretos: 1,
              datos_personales: 0,
              logs_sensibles: 0,
              transporte_inseguro: 1,
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
              id: 'secret-exposed:src/alpha.ts:4',
              ruleId: 'secret-exposed',
              severity: 'high',
              category: 'secretos',
              language: 'typescript',
              path: 'src/alpha.ts',
              line: 4,
              explanation: 'Se detecto un secreto.',
              evidence: 'const API_KEY = "[REDACTED]";',
              recommendation: 'Rote la credencial.',
              status: 'no cumple',
              reference: {
                id: 'lopdp',
                title: 'Ley de Proteccion de Datos Personales',
                url: 'https://example.test/lopdp',
                verifiedAt: '2026-08-27',
                status: 'vigente',
                topic: 'datos personales',
                rationale: 'Base general de privacidad.',
              },
            },
            {
              id: 'insecure-http:src/zeta.ts:19',
              ruleId: 'insecure-http',
              severity: 'medium',
              category: 'transporte_inseguro',
              language: 'typescript',
              path: 'src/zeta.ts',
              line: 19,
              explanation: 'Se detecto transporte inseguro.',
              evidence: 'fetch("http://api.example.com/<admin>")',
              recommendation: 'Use HTTPS.',
              status: 'pendiente',
              reference: {
                id: 'comercio-electronico',
                title: 'Ley de Comercio Electronico',
                url: 'https://example.test/comercio',
                verifiedAt: '2026-08-27',
                status: 'reformado',
                topic: 'seguridad de servicios digitales',
                rationale: 'Controles de transporte seguro.',
              },
            },
          ],
          controls: [
            {
              id: 'control-general',
              category: 'general',
              title: 'Revisar alcance',
              description: 'Validar alcance y evidencia.',
              referenceIds: ['lopdp', 'comercio-electronico'],
              status: 'cumple',
            },
            {
              id: 'control-secretos',
              category: 'secretos',
              title: 'Gestionar secretos',
              description: 'Sacar secretos del repositorio.',
              referenceIds: ['lopdp'],
              status: 'no cumple',
            },
            {
              id: 'control-transporte',
              category: 'transporte_inseguro',
              title: 'Forzar transporte seguro',
              description: 'Eliminar integraciones HTTP en produccion.',
              referenceIds: ['comercio-electronico'],
              status: 'pendiente',
            },
          ],
          references: [
            {
              id: 'comercio-electronico',
              title: 'Ley de Comercio Electronico',
              url: 'https://example.test/comercio',
              verifiedAt: '2026-08-27',
              status: 'reformado',
              topic: 'seguridad de servicios digitales',
              rationale: 'Controles de transporte seguro.',
            },
            {
              id: 'lopdp',
              title: 'Ley de Proteccion de Datos Personales',
              url: 'https://example.test/lopdp',
              verifiedAt: '2026-08-27',
              status: 'vigente',
              topic: 'datos personales',
              rationale: 'Base general de privacidad.',
            },
          ],
          skippedChecks: [
            {
              id: 'docker-base-image',
              title: 'Imagen base Docker',
              reason: 'No se detecto Dockerfile.',
            },
            {
              id: 'terraform-state',
              title: 'Estado Terraform',
              reason: 'No se detectaron archivos .tf.',
            },
          ],
          dependencyScan: {
            enabled: true,
            summary: {
              totalFindings: 2,
              findingsBySeverity: {
                critical: 1,
                high: 0,
                medium: 0,
                low: 1,
                unknown: 0,
              },
              scannersByStatus: {
                completed: 1,
                failed: 0,
                unavailable: 1,
                skipped: 1,
              },
            },
            scanners: [
              {
                scanner: 'npm',
                status: 'completed',
                targets: ['web/package-lock.json'],
                findingCount: 1,
                warningCount: 0,
              },
              {
                scanner: 'osv-scanner',
                status: 'skipped',
                targets: [],
                findingCount: 0,
                warningCount: 0,
              },
              {
                scanner: 'pip-audit',
                status: 'unavailable',
                targets: ['api/requirements.txt'],
                findingCount: 0,
                warningCount: 1,
              },
            ],
            findings: [
              {
                id: 'npm:web-package-lock-json:minimatch:ghsa',
                scanner: 'npm',
                ecosystem: 'npm',
                packageName: 'minimatch',
                severity: 'critical',
                summary: 'Regular expression denial of service',
                manifestPath: 'web/package-lock.json',
                installedVersion: '3.0.0',
                fixedVersion: '3.0.5',
                advisoryId: 'GHSA-f8q6-p94x-37v3',
                advisoryUrl: 'https://github.com/advisories/GHSA-f8q6-p94x-37v3',
                direct: true,
              },
              {
                id: 'cargo:native-cargo-lock:time:rustsec',
                scanner: 'cargo-audit',
                ecosystem: 'cargo',
                packageName: 'time',
                severity: 'low',
                summary: 'Potential issue in time crate',
                manifestPath: 'native/Cargo.lock',
                installedVersion: '0.1.0',
                fixedVersion: '0.2.23',
                advisoryId: 'RUSTSEC-2020-0159',
                advisoryUrl: 'https://rustsec.org/advisories/RUSTSEC-2020-0159.html',
              },
            ],
            warnings: [
              {
                scanner: 'pip-audit',
                code: 'tool_unavailable',
                message: 'La herramienta pip-audit no esta disponible localmente.',
                target: 'api/requirements.txt',
              },
            ],
          },
          disclaimer: 'Orientacion preliminar y tecnica.',
        },
        null,
        2,
      ),
    );
  });

  it('renders deterministic Markdown with ordered sections', () => {
    const rendered = renderAuditReportMarkdown(auditReport, {
      dependencyScan,
      skippedChecks,
    });

    expect(rendered).toBe(`# Reporte de auditoria: demo-repo

- Generado: \`2026-08-29T12:00:00.000Z\`
- Riesgo: \`critical\`
- Resumen ejecutivo: Se detectaron 4 hallazgos: 2 de auditoria local y 2 de dependencias.
- Puntuacion de riesgo: 68/100 (inmediata)

## Resumen ejecutivo

- Hallazgos totales: 4
- Hallazgos de auditoria: 2
- Hallazgos de dependencias: 2
- Archivos escaneados: 4
- Directorios escaneados: 3
- Entradas omitidas: 2
- Checks omitidos: 2
- Advertencias de dependencias: 1

## Estado de escaneres de dependencias

| Escaner | Estado | Targets | Hallazgos | Advertencias |
| --- | --- | --- | ---: | ---: |
| npm | completed | web/package-lock.json | 1 | 0 |
| osv-scanner | skipped | - | 0 | 0 |
| pip-audit | unavailable | api/requirements.txt | 0 | 1 |

## Hallazgos de auditoria

| Severidad | Regla | Archivo | Linea | Estado | Evidencia |
| --- | --- | --- | ---: | --- | --- |
| high | secret-exposed | src/alpha.ts | 4 | no cumple | const API_KEY = "[REDACTED]"; |
| medium | insecure-http | src/zeta.ts | 19 | pendiente | fetch("http://api.example.com/&lt;admin&gt;") |

## Hallazgos de dependencias

| Severidad | Escaner | Paquete | Manifest | Fija en |
| --- | --- | --- | --- | --- |
| critical | npm | minimatch | web/package-lock.json | 3.0.5 |
| low | cargo-audit | time | native/Cargo.lock | 0.2.23 |

## Checks omitidos

- docker-base-image: Imagen base Docker. No se detecto Dockerfile.
- terraform-state: Estado Terraform. No se detectaron archivos .tf.

## Controles

| Control | Categoria | Estado | Referencias |
| --- | --- | --- | --- |
| control-general | general | cumple | lopdp, comercio-electronico |
| control-secretos | secretos | no cumple | lopdp |
| control-transporte | transporte_inseguro | pendiente | comercio-electronico |

## Referencias

- comercio-electronico: Ley de Comercio Electronico ([fuente](https://example.test/comercio)) - reformado, verificada 2026-08-27
- lopdp: Ley de Proteccion de Datos Personales ([fuente](https://example.test/lopdp)) - vigente, verificada 2026-08-27

## Disclaimer

Orientacion preliminar y tecnica.
`);
  });

  it('renders deterministic HTML and a PDF-friendly variant', () => {
    const html = renderAuditReportHtml(auditReport, {
      dependencyScan,
      skippedChecks,
    });
    const pdfHtml = renderAuditReportHtml(auditReport, {
      dependencyScan,
      skippedChecks,
      pdfCompatible: true,
    });

    expect(renderAuditReportHtml(auditReport, { dependencyScan, skippedChecks })).toBe(html);
    expect(html).toContain('<title>Reporte de auditoria - demo-repo</title>');
    expect(html).toContain('data-risk-level="critical"');
    expect(html).toContain('Se detectaron 4 hallazgos: 2 de auditoria local y 2 de dependencias.');
    expect(html).toContain('fetch(&quot;http://api.example.com/&lt;admin&gt;&quot;)');
    expect(html).not.toContain('<admin>');
    expect(html).toContain('<td>npm</td>');
    expect(html).toContain('<td>completed</td>');
    expect(pdfHtml).toContain('class="report report--pdf"');
    expect(pdfHtml).toContain('@page { size: A4; margin: 16mm; }');
    expect(pdfHtml).toContain('<meta name="color-scheme" content="light only" />');
  });
});
