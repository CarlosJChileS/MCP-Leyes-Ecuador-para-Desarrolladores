import type { AuditReport } from './audit.js';
import type { DependencyScanReport } from './dependencies.js';

export function renderAuditReportSarif(report: AuditReport, dependencyScan?: DependencyScanReport): string {
  const results = report.findings.map(finding => ({ ruleId: finding.ruleId, level: finding.severity === 'critical' || finding.severity === 'high' ? 'error' : finding.severity === 'medium' ? 'warning' : 'note', message: { text: `${finding.explanation} ${finding.recommendation}` }, locations: [{ physicalLocation: { artifactLocation: { uri: finding.path.replaceAll('\\', '/') }, region: finding.line ? { startLine: finding.line } : undefined } }] }));
  for (const finding of dependencyScan?.findings ?? []) results.push({ ruleId: finding.advisoryId ?? finding.id, level: finding.severity === 'critical' || finding.severity === 'high' ? 'error' : 'warning', message: { text: `${finding.summary}. Actual: ${finding.installedVersion}; corregir a: ${finding.fixedVersion ?? 'versión soportada'}.` }, locations: [{ physicalLocation: { artifactLocation: { uri: finding.manifestPath.replaceAll('\\', '/') }, region: undefined } }] });
  return JSON.stringify({ version: '2.1.0', $schema: 'https://json.schemastore.org/sarif-2.1.0.json', runs: [{ tool: { driver: { name: 'eculegaldev', informationUri: 'https://github.com/CarlosJChileS/eculegaldev' } }, results }] }, null, 2);
}
