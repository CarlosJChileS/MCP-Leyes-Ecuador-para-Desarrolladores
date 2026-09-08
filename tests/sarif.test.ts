import { describe, expect, it } from 'vitest';
import { renderAuditReportSarif } from '../src/sarif.js';
import type { AuditReport } from '../src/audit.js';

const report = {
  summary: { repository: 'demo', rootPath: '/tmp/demo', generatedAt: '2026-01-01T00:00:00.000Z', scannedFiles: 1, scannedDirectories: 1, skippedEntries: 0, totalFindings: 1, languages: {}, findingsBySeverity: { critical: 0, high: 1, medium: 0, low: 0 }, findingsByCategory: { secretos: 1, datos_personales: 0, logs_sensibles: 0, transporte_inseguro: 0, cors: 0, cookies: 0, endpoints_sensibles: 0, infraestructura: 0, documentacion: 0 }, limits: { maxDepth: 6, maxFiles: 500, maxFileSizeBytes: 1024 } },
  findings: [{ id: 'x', ruleId: 'secret-exposed', severity: 'high', category: 'secretos', language: 'typescript', path: 'src/a.ts', line: 4, explanation: 'Se detectó un secreto.', evidence: '[REDACTED]', recommendation: 'Rote la credencial.', reference: { id: 'lopdp', title: 'LOPDP', url: 'https://example.com', verifiedAt: '2026-01-01', status: 'pendiente_verificacion', topic: 'datos', rationale: 'seguridad' }, status: 'pendiente' }], controls: [], references: [], disclaimer: 'preliminar',
} as AuditReport;

describe('SARIF renderer', () => {
  it('emits SARIF 2.1.0 with source locations and remediation text', () => {
    const output = JSON.parse(renderAuditReportSarif(report));
    expect(output.version).toBe('2.1.0');
    expect(output.runs[0].results[0]).toMatchObject({ ruleId: 'secret-exposed', level: 'error', locations: [{ physicalLocation: { artifactLocation: { uri: 'src/a.ts' }, region: { startLine: 4 } } }] });
    expect(output.runs[0].results[0].message.text).toContain('Rote la credencial');
  });
});
