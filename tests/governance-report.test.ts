import { describe, expect, it } from 'vitest';
import { buildGovernanceReport, renderGovernanceReportHtml, renderGovernanceReportMarkdown, renderGovernanceReportPdf } from '../src/governance-report.js';
import type { LegalSource } from '../src/domain.js';

const source: LegalSource = {
  id: 'lopdp', title: 'LOPDP', type: 'ley', issuer: 'Ecuador', jurisdiction: 'Ecuador',
  publishedAt: '2021-05-26', verifiedAt: '2026-01-01', status: 'pendiente_verificacion',
  url: 'https://www.registroficial.gob.ec/lopdp', topics: ['datos personales', 'privacidad'],
};
const profile = { name: 'API ciudadana', dataTypes: ['cédula', 'correo'], systems: ['API'], owners: ['responsable'], sharesExternally: true, internationalTransfers: true, automatedDecisions: true, retentionDays: 365 };

describe('consolidated governance report', () => {
  it('combines the five governance assessments in one stable report', () => {
    const report = buildGovernanceReport(profile, [source]);
    expect(report.schemaVersion).toBe(1);
    expect(report.sections).toMatchObject({ governance: expect.any(Object), inventory: expect.any(Object), transfers: expect.any(Object), impactAssessment: expect.any(Object), responsibilities: expect.any(Object) });
    expect(report.executiveSummary).toMatchObject({ project: 'API ciudadana', totalDomains: 22, evidenceRequired: expect.any(Number) });
  });

  it('renders explanatory Markdown and print-ready HTML', () => {
    const report = buildGovernanceReport(profile, [source]);
    expect(renderGovernanceReportMarkdown(report)).toContain('# Informe de gobernanza de datos: API ciudadana');
    expect(renderGovernanceReportMarkdown(report)).toContain('## Transferencias de datos');
    expect(renderGovernanceReportHtml(report)).toContain('@page { size: A4');
  });

  it('exports a real PDF document', async () => {
    const bytes = await renderGovernanceReportPdf(buildGovernanceReport(profile, [source]));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('explains every issue with actionable remediation and ownership', () => {
    const report = buildGovernanceReport({ name: 'Proyecto incompleto', sharesExternally: true }, [source]);
    expect(report.remediationPlan.length).toBeGreaterThan(0);
    expect(report.remediationPlan[0]).toMatchObject({
      id: expect.any(String),
      area: expect.any(String),
      problem: expect.any(String),
      whyItMatters: expect.any(String),
      priority: expect.stringMatching(/^(critica|alta|media|baja)$/),
      suggestedOwner: expect.any(String),
      steps: expect.arrayContaining([expect.any(String)]),
      expectedEvidence: expect.arrayContaining([expect.any(String)]),
      completionCriteria: expect.any(String),
    });
    expect(report.executiveSummary).toMatchObject({ totalActions: report.remediationPlan.length, criticalActions: expect.any(Number), highPriorityActions: expect.any(Number) });
    const markdown = renderGovernanceReportMarkdown(report);
    expect(markdown).toContain('## Plan detallado de solución');
    expect(markdown).toContain('### GOV-');
    expect(markdown).toContain('**Cómo solucionarlo**');
    expect(markdown).toContain('**Criterio de cierre:**');
  });
});
