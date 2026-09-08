import { localizeAuditReport, reportTemplate } from './audit-i18n.js';
import type { Language } from './i18n.js';
import type {
  AuditControl,
  AuditFinding,
  AuditReference,
  AuditReport,
  AuditSeverity,
  AuditStatus,
  AuditSummary,
} from './audit.js';
import type {
  DependencyFinding,
  DependencyScanReport,
  DependencyScanSummary,
  DependencyScannerResult,
  DependencyScannerStatus,
  DependencySeverity,
  DependencyWarning,
} from './dependencies.js';
import { KNOWN_LANGUAGE_ORDER, type DetectedLanguage } from './languages.js';

const AUDIT_SEVERITY_ORDER: AuditSeverity[] = ['critical', 'high', 'medium', 'low'];
const DEPENDENCY_SEVERITY_ORDER: DependencySeverity[] = ['critical', 'high', 'medium', 'low', 'unknown'];
const AUDIT_CATEGORY_ORDER = [
  'secretos',
  'datos_personales',
  'logs_sensibles',
  'transporte_inseguro',
  'cors',
  'cookies',
  'endpoints_sensibles',
  'infraestructura',
  'documentacion',
] as const;
const SCANNER_STATUS_ORDER: DependencyScannerStatus[] = ['completed', 'failed', 'unavailable', 'skipped'];
const STATUS_ORDER: AuditStatus[] = ['no cumple', 'pendiente', 'no aplica', 'cumple'];

export type ReportRiskLevel = AuditSeverity | 'none';

export type ReportSkippedCheck = {
  id: string;
  title: string;
  reason: string;
};

export type AuditReportRenderOptions = {
  language?: Language;
  dependencyScan?: DependencyScanReport;
  skippedChecks?: ReportSkippedCheck[];
  pdfCompatible?: boolean;
  includeDependencyWarnings?: boolean;
};

export type RenderedAuditReport = {
  schemaVersion: 1;
  generatedAt: string;
  repository: {
    name: string;
    rootPath: string;
  };
  riskLevel: ReportRiskLevel;
  riskScore: number;
  remediationPriority: 'inmediata' | 'alta' | 'media' | 'baja' | 'ninguna';
  executiveSummary: {
    headline: string;
    totalFindings: number;
    totalAuditFindings: number;
    totalDependencyFindings: number;
    scannedFiles: number;
    scannedDirectories: number;
    skippedEntries: number;
    skippedChecks: number;
    dependencyWarnings: number;
  };
  summary: AuditSummary;
  findings: AuditFinding[];
  controls: AuditControl[];
  references: AuditReference[];
  skippedChecks: ReportSkippedCheck[];
  dependencyScan: {
    enabled: boolean;
    summary: DependencyScanSummary;
    scanners: Array<{
      scanner: string;
      status: DependencyScannerStatus;
      targets: string[];
      findingCount: number;
      warningCount: number;
    }>;
    findings: DependencyFinding[];
    warnings: DependencyWarning[];
  };
  disclaimer: string;
};

export function buildRenderedAuditReport(
  report: AuditReport,
  options: AuditReportRenderOptions = {},
): RenderedAuditReport {
  report = localizeAuditReport(report, options.language ?? 'es');
  const findings = [...report.findings].sort(compareAuditFindings);
  const controls = [...report.controls].sort(compareControls);
  const references = [...report.references].sort(compareReferences);
  const skippedChecks = [...(options.skippedChecks ?? []), ...(report.warnings ?? []).map((reason, index) => ({ id: `config-${index}`, title: options.language === 'en' ? 'Audit configuration warning' : 'Advertencia de configuración', reason }))].sort(compareSkippedChecks);
  const dependencyScan = buildDependencySection(options.dependencyScan);
  const totalAuditFindings = findings.length;
  const totalDependencyFindings = dependencyScan.findings.length;
  const totalFindings = totalAuditFindings + totalDependencyFindings;

  return {
    schemaVersion: 1,
    generatedAt: report.summary.generatedAt,
    repository: {
      name: report.summary.repository,
      rootPath: report.summary.rootPath,
    },
    riskLevel: resolveRiskLevel(findings, dependencyScan.findings),
    riskScore: calculateRiskScore(findings, dependencyScan.findings),
    remediationPriority: calculateRemediationPriority(findings, dependencyScan.findings),
    executiveSummary: {
      headline: options.language === 'en' ? `${totalFindings} findings detected: ${totalAuditFindings} from local audit and ${totalDependencyFindings} from dependencies.` : `Se detectaron ${totalFindings} hallazgos: ${totalAuditFindings} de auditoria local y ${totalDependencyFindings} de dependencias.`,
      totalFindings,
      totalAuditFindings,
      totalDependencyFindings,
      scannedFiles: report.summary.scannedFiles,
      scannedDirectories: report.summary.scannedDirectories,
      skippedEntries: report.summary.skippedEntries,
      skippedChecks: skippedChecks.length,
      dependencyWarnings: dependencyScan.warnings.length,
    },
    summary: normalizeSummary(report.summary),
    findings,
    controls,
    references,
    skippedChecks,
    dependencyScan,
    disclaimer: report.disclaimer,
  };
}

export function renderAuditReportJson(report: AuditReport, options: AuditReportRenderOptions = {}): string {
  return JSON.stringify(buildRenderedAuditReport(report, options), null, 2);
}

export function renderAuditReportMarkdown(report: AuditReport, options: AuditReportRenderOptions = {}): string {
  const t = reportTemplate(options.language);
  const rendered = buildRenderedAuditReport(report, options);
  const lines = [
    t`# Reporte de auditoria: ${rendered.repository.name}`,
    '',
    t`- Generado: \`${rendered.generatedAt}\``,
    t`- Riesgo: \`${rendered.riskLevel}\``,
    t`- Resumen ejecutivo: ${rendered.executiveSummary.headline}`,
    t`- Puntuacion de riesgo: ${rendered.riskScore}/100 (${rendered.remediationPriority})`,
    '',
    t`## Resumen ejecutivo`,
    '',
    t`- Hallazgos totales: ${rendered.executiveSummary.totalFindings}`,
    t`- Hallazgos de auditoria: ${rendered.executiveSummary.totalAuditFindings}`,
    t`- Hallazgos de dependencias: ${rendered.executiveSummary.totalDependencyFindings}`,
    t`- Archivos escaneados: ${rendered.executiveSummary.scannedFiles}`,
    t`- Directorios escaneados: ${rendered.executiveSummary.scannedDirectories}`,
    t`- Entradas omitidas: ${rendered.executiveSummary.skippedEntries}`,
    t`- Checks omitidos: ${rendered.executiveSummary.skippedChecks}`,
    t`- Advertencias de dependencias: ${rendered.executiveSummary.dependencyWarnings}`,
    '',
    t`## Estado de escaneres de dependencias`,
    '',
    t`| Escaner | Estado | Targets | Hallazgos | Advertencias |`,
    '| --- | --- | --- | ---: | ---: |',
    ...renderDependencyScannerRows(rendered),
    ...(options.includeDependencyWarnings ? ['', t`### Advertencias`, '', ...rendered.dependencyScan.warnings.map((warning) => `- ${warning.scanner}: ${warning.message}`), ''] : []),
    '',
    t`## Hallazgos de auditoria`,
    '',
    t`| Severidad | Regla | Archivo | Linea | Estado | Evidencia |`,
    '| --- | --- | --- | ---: | --- | --- |',
    ...renderAuditFindingRows(rendered.findings, options.language),
    '',
    t`## Hallazgos de dependencias`,
    '',
    t`| Severidad | Escaner | Paquete | Manifest | Fija en |`,
    '| --- | --- | --- | --- | --- |',
    ...renderDependencyFindingRows(rendered.dependencyScan.findings),
    '',
    t`## Checks omitidos`,
    '',
    ...renderSkippedCheckLines(rendered.skippedChecks, options.language),
    '',
    t`## Controles`,
    '',
    t`| Control | Categoria | Estado | Referencias |`,
    '| --- | --- | --- | --- |',
    ...renderControlRows(rendered.controls),
    '',
    t`## Referencias`,
    '',
    ...renderReferenceLines(rendered.references, options.language),
    '',
    '## Disclaimer',
    '',
    escapeMarkdownText(rendered.disclaimer),
    '',
  ];

  return lines.join('\n');
}

export function renderAuditReportHtml(report: AuditReport, options: AuditReportRenderOptions = {}): string {
  const t = reportTemplate(options.language);
  const rendered = buildRenderedAuditReport(report, options);
  const css = buildHtmlStyles(Boolean(options.pdfCompatible));
  const reportClass = options.pdfCompatible ? 'report report--pdf' : 'report';

  return [
    '<!DOCTYPE html>',
    `<html lang="${options.language ?? 'es'}">`,
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<meta name="color-scheme" content="light only" />',
    t`<title>Reporte de auditoria - ${escapeHtml(rendered.repository.name)}</title>`,
    `<style>${css}</style>`,
    '</head>',
    `<body class="${reportClass}" data-risk-level="${rendered.riskLevel}">`,
    '<main>',
    t`<header><h1>Reporte de auditoria: ${escapeHtml(rendered.repository.name)}</h1><p>${escapeHtml(rendered.executiveSummary.headline)}</p></header>`,
    t`<section><h2>Resumen ejecutivo</h2><dl>`,
    renderDefinitionRow(t`Generado`, rendered.generatedAt),
    renderDefinitionRow(t`Riesgo`, rendered.riskLevel),
    renderDefinitionRow(t`Puntuación de riesgo`, `${rendered.riskScore}/100`),
    renderDefinitionRow(t`Prioridad`, rendered.remediationPriority),
    renderDefinitionRow(t`Hallazgos totales`, String(rendered.executiveSummary.totalFindings)),
    renderDefinitionRow(t`Hallazgos de auditoria`, String(rendered.executiveSummary.totalAuditFindings)),
    renderDefinitionRow(t`Hallazgos de dependencias`, String(rendered.executiveSummary.totalDependencyFindings)),
    renderDefinitionRow(t`Archivos escaneados`, String(rendered.executiveSummary.scannedFiles)),
    renderDefinitionRow(t`Directorios escaneados`, String(rendered.executiveSummary.scannedDirectories)),
    renderDefinitionRow(t`Entradas omitidas`, String(rendered.executiveSummary.skippedEntries)),
    renderDefinitionRow(t`Checks omitidos`, String(rendered.executiveSummary.skippedChecks)),
    renderDefinitionRow(t`Advertencias de dependencias`, String(rendered.executiveSummary.dependencyWarnings)),
    '</dl></section>',
    t`<section><h2>Estado de escaneres de dependencias</h2>`,
    t`<table><thead><tr><th>Escaner</th><th>Estado</th><th>Targets</th><th>Hallazgos</th><th>Advertencias</th></tr></thead><tbody>`,
    ...rendered.dependencyScan.scanners.map((scanner) => {
      return `<tr><td>${escapeHtml(scanner.scanner)}</td><td>${escapeHtml(scanner.status)}</td><td>${escapeHtml(scanner.targets.join(', ') || '-')}</td><td>${scanner.findingCount}</td><td>${scanner.warningCount}</td></tr>`;
    }),
    '</tbody></table>',
    ...(options.includeDependencyWarnings ? [t`<h3>Advertencias</h3><ul>`, ...rendered.dependencyScan.warnings.map((warning) => `<li>${escapeHtml(warning.scanner)}: ${escapeHtml(warning.message)}</li>`), '</ul>'] : []),
    '</section>',
    t`<section><h2>Hallazgos de auditoria</h2>`,
    t`<table><thead><tr><th>Severidad</th><th>Regla</th><th>Archivo</th><th>Linea</th><th>Estado</th><th>Evidencia</th></tr></thead><tbody>`,
    ...rendered.findings.map((finding) => {
      return `<tr><td>${escapeHtml(finding.severity)}</td><td>${escapeHtml(finding.ruleId)}</td><td>${escapeHtml(finding.path)}</td><td>${finding.line ?? '-'}</td><td>${escapeHtml(finding.status)}</td><td>${escapeHtml(finding.evidence)}</td></tr>`;
    }),
    '</tbody></table></section>',
    t`<section><h2>Hallazgos de dependencias</h2>`,
    t`<table><thead><tr><th>Severidad</th><th>Escaner</th><th>Paquete</th><th>Manifest</th><th>Fija en</th></tr></thead><tbody>`,
    ...rendered.dependencyScan.findings.map((finding) => {
      return `<tr><td>${escapeHtml(finding.severity)}</td><td>${escapeHtml(finding.scanner)}</td><td>${escapeHtml(finding.packageName)}</td><td>${escapeHtml(finding.manifestPath)}</td><td>${escapeHtml(finding.fixedVersion ?? '-')}</td></tr>`;
    }),
    '</tbody></table></section>',
    t`<section><h2>Checks omitidos</h2><ul>`,
    ...rendered.skippedChecks.map((check) => `<li><strong>${escapeHtml(check.id)}</strong>: ${escapeHtml(check.title)}. ${escapeHtml(check.reason)}</li>`),
    '</ul></section>',
    t`<section><h2>Controles</h2>`,
    t`<table><thead><tr><th>Control</th><th>Categoria</th><th>Estado</th><th>Referencias</th></tr></thead><tbody>`,
    ...rendered.controls.map((control) => {
      return `<tr><td>${escapeHtml(control.id)}</td><td>${escapeHtml(control.category)}</td><td>${escapeHtml(control.status)}</td><td>${escapeHtml(control.referenceIds.join(', '))}</td></tr>`;
    }),
    '</tbody></table></section>',
    t`<section><h2>Referencias</h2><ul>`,
    ...rendered.references.map((reference) => {
      return t`<li><strong>${escapeHtml(reference.id)}</strong>: ${escapeHtml(reference.title)} (<a href="${escapeHtmlAttribute(reference.url)}">fuente</a>) - ${escapeHtml(reference.status)}, verificada ${escapeHtml(reference.verifiedAt)}</li>`;
    }),
    '</ul></section>',
    `<section><h2>Disclaimer</h2><p>${escapeHtml(rendered.disclaimer)}</p></section>`,
    '</main>',
    '</body>',
    '</html>',
  ].join('');
}

function normalizeSummary(summary: AuditSummary): AuditSummary {
  return {
    ...summary,
    languages: orderSparseCountRecord(summary.languages),
    findingsBySeverity: orderCountRecord(summary.findingsBySeverity, AUDIT_SEVERITY_ORDER),
    findingsByCategory: orderCountRecord(summary.findingsByCategory, AUDIT_CATEGORY_ORDER),
  };
}

function buildDependencySection(dependencyScan: DependencyScanReport | undefined): RenderedAuditReport['dependencyScan'] {
  if (!dependencyScan) {
    return {
      enabled: false,
      summary: {
        totalFindings: 0,
        findingsBySeverity: orderCountRecord({}, DEPENDENCY_SEVERITY_ORDER),
        scannersByStatus: orderCountRecord({}, SCANNER_STATUS_ORDER),
      },
      scanners: [],
      findings: [],
      warnings: [],
    };
  }

  const findings = [...dependencyScan.findings].sort(compareDependencyFindings);
  const warnings = [...dependencyScan.warnings].sort(compareDependencyWarnings);
  const scanners = [...dependencyScan.scanners]
    .sort((left, right) => left.scanner.localeCompare(right.scanner, 'en'))
    .map((scanner) => ({
      scanner: scanner.scanner,
      status: scanner.status,
      targets: [...scanner.targets].sort((left, right) => left.localeCompare(right, 'en')),
      findingCount: scanner.findings.length,
      warningCount: scanner.warnings.length,
    }));

  return {
    enabled: true,
    summary: {
      totalFindings: dependencyScan.summary.totalFindings,
      findingsBySeverity: orderCountRecord(dependencyScan.summary.findingsBySeverity, DEPENDENCY_SEVERITY_ORDER),
      scannersByStatus: orderCountRecord(dependencyScan.summary.scannersByStatus, SCANNER_STATUS_ORDER),
    },
    scanners,
    findings,
    warnings,
  };
}

function resolveRiskLevel(findings: AuditFinding[], dependencyFindings: DependencyFinding[]): ReportRiskLevel {
  const severities: Array<AuditSeverity | DependencySeverity> = [
    ...findings.map((finding) => finding.severity),
    ...dependencyFindings.map((finding) => finding.severity),
  ];

  for (const severity of AUDIT_SEVERITY_ORDER) {
    if (severities.includes(severity)) {
      return severity;
    }
  }

  return severities.includes('unknown') ? 'low' : 'none';
}

function calculateRiskScore(findings: AuditFinding[], dependencyFindings: DependencyFinding[]): number {
  const weights: Record<string, number> = { critical: 35, high: 20, medium: 10, low: 3, unknown: 2 };
  return Math.min(100, [...findings, ...dependencyFindings].reduce((total, finding) => total + (weights[finding.severity] ?? 0), 0));
}

function calculateRemediationPriority(findings: AuditFinding[], dependencyFindings: DependencyFinding[]): RenderedAuditReport['remediationPriority'] {
  const level = resolveRiskLevel(findings, dependencyFindings);
  return level === 'critical' ? 'inmediata' : level === 'high' ? 'alta' : level === 'medium' ? 'media' : level === 'low' ? 'baja' : 'ninguna';
}

function renderDependencyScannerRows(rendered: RenderedAuditReport): string[] {
  if (rendered.dependencyScan.scanners.length === 0) {
    return ['| - | not_run | - | 0 | 0 |'];
  }

  return rendered.dependencyScan.scanners.map((scanner) => {
    const targets = scanner.targets.length > 0 ? scanner.targets.join(', ') : '-';
    return `| ${escapeMarkdownCell(scanner.scanner)} | ${escapeMarkdownCell(scanner.status)} | ${escapeMarkdownCell(targets)} | ${scanner.findingCount} | ${scanner.warningCount} |`;
  });
}

function renderAuditFindingRows(findings: AuditFinding[], language?: Language): string[] {
  const t = reportTemplate(language);
  if (findings.length === 0) {
    return [t`| - | - | - | 0 | cumple | Sin hallazgos |`];
  }

  return findings.map((finding) => {
    return `| ${escapeMarkdownCell(finding.severity)} | ${escapeMarkdownCell(finding.ruleId)} | ${escapeMarkdownCell(finding.path)} | ${finding.line ?? '-'} | ${escapeMarkdownCell(finding.status)} | ${escapeMarkdownCell(finding.evidence)} |`;
  });
}

function renderDependencyFindingRows(findings: DependencyFinding[]): string[] {
  if (findings.length === 0) {
    return ['| - | - | - | - | - |'];
  }

  return findings.map((finding) => {
    return `| ${escapeMarkdownCell(finding.severity)} | ${escapeMarkdownCell(finding.scanner)} | ${escapeMarkdownCell(finding.packageName)} | ${escapeMarkdownCell(finding.manifestPath)} | ${escapeMarkdownCell(finding.fixedVersion ?? '-')} |`;
  });
}

function renderSkippedCheckLines(skippedChecks: ReportSkippedCheck[], language?: Language): string[] {
  const t = reportTemplate(language);
  if (skippedChecks.length === 0) {
    return [t`- Ninguno.`];
  }

  return skippedChecks.map((check) => `- ${escapeMarkdownText(check.id)}: ${escapeMarkdownText(check.title)}. ${escapeMarkdownText(check.reason)}`);
}

function renderControlRows(controls: AuditControl[]): string[] {
  if (controls.length === 0) {
    return ['| - | - | - | - |'];
  }

  return controls.map((control) => {
    return `| ${escapeMarkdownCell(control.id)} | ${escapeMarkdownCell(control.category)} | ${escapeMarkdownCell(control.status)} | ${escapeMarkdownCell(control.referenceIds.join(', '))} |`;
  });
}

function renderReferenceLines(references: AuditReference[], language?: Language): string[] {
  const t = reportTemplate(language);
  if (references.length === 0) {
    return [t`- Sin referencias.`];
  }

  return references.map((reference) => {
    return t`- ${escapeMarkdownText(reference.id)}: ${escapeMarkdownText(reference.title)} ([fuente](${reference.url})) - ${escapeMarkdownText(reference.status)}, verificada ${escapeMarkdownText(reference.verifiedAt)}`;
  });
}

function renderDefinitionRow(term: string, value: string): string {
  return `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function buildHtmlStyles(pdfCompatible: boolean): string {
  const printRules = pdfCompatible ? '@page { size: A4; margin: 16mm; }' : '';
  return [
    printRules,
    'body { font-family: Arial, sans-serif; background: #f5f7fb; color: #162033; margin: 0; }',
    '.report main { max-width: 1120px; margin: 0 auto; padding: 32px; }',
    '.report--pdf main { max-width: none; padding: 0; }',
    'header, section { background: #ffffff; border: 1px solid #d8e0ef; border-radius: 12px; padding: 20px; margin: 0 0 16px; }',
    'h1, h2 { margin: 0 0 12px; }',
    'p, li, dt, dd, th, td { line-height: 1.5; }',
    'dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 0; }',
    'dl div { border: 1px solid #e3e9f5; border-radius: 10px; padding: 12px; }',
    'dt { font-weight: 700; }',
    'dd { margin: 4px 0 0; }',
    'table { width: 100%; border-collapse: collapse; }',
    'th, td { border: 1px solid #d8e0ef; padding: 10px; text-align: left; vertical-align: top; }',
    'thead { background: #eef3fb; }',
    'ul { margin: 0; padding-left: 20px; }',
    'a { color: #0a58ca; }',
  ].join('');
}

function compareAuditFindings(left: AuditFinding, right: AuditFinding): number {
  return (
    compareByOrder(left.severity, right.severity, AUDIT_SEVERITY_ORDER) ||
    left.path.localeCompare(right.path, 'en') ||
    (left.line ?? 0) - (right.line ?? 0) ||
    left.ruleId.localeCompare(right.ruleId, 'en') ||
    left.id.localeCompare(right.id, 'en')
  );
}

function compareControls(left: AuditControl, right: AuditControl): number {
  return left.id.localeCompare(right.id, 'en');
}

function compareReferences(left: AuditReference, right: AuditReference): number {
  return left.id.localeCompare(right.id, 'en');
}

function compareSkippedChecks(left: ReportSkippedCheck, right: ReportSkippedCheck): number {
  return left.id.localeCompare(right.id, 'en') || left.title.localeCompare(right.title, 'en') || left.reason.localeCompare(right.reason, 'en');
}

function compareDependencyFindings(left: DependencyFinding, right: DependencyFinding): number {
  return (
    compareByOrder(left.severity, right.severity, DEPENDENCY_SEVERITY_ORDER) ||
    left.scanner.localeCompare(right.scanner, 'en') ||
    left.manifestPath.localeCompare(right.manifestPath, 'en') ||
    left.packageName.localeCompare(right.packageName, 'en') ||
    (left.advisoryId ?? '').localeCompare(right.advisoryId ?? '', 'en') ||
    left.id.localeCompare(right.id, 'en')
  );
}

function compareDependencyWarnings(left: DependencyWarning, right: DependencyWarning): number {
  return (
    left.scanner.localeCompare(right.scanner, 'en') ||
    left.code.localeCompare(right.code, 'en') ||
    (left.target ?? '').localeCompare(right.target ?? '', 'en') ||
    left.message.localeCompare(right.message, 'en')
  );
}

function compareByOrder<T extends string>(left: T, right: T, order: readonly T[]): number {
  return order.indexOf(left) - order.indexOf(right);
}

function orderCountRecord<T extends string>(
  record: Partial<Record<T, number>>,
  order: readonly T[],
): Record<T, number> {
  const entries: Array<[T, number]> = [];
  for (const key of order) {
    entries.push([key, record[key] ?? 0]);
  }

  const extraKeys = Object.keys(record)
    .filter((key): key is T => !order.includes(key as T))
    .sort((left, right) => left.localeCompare(right, 'en'));

  for (const key of extraKeys) {
    entries.push([key, record[key] ?? 0]);
  }

  return Object.fromEntries(entries) as Record<T, number>;
}

function escapeMarkdownCell(value: string): string {
  return escapeMarkdownText(value).replace(/\n/g, '<br />');
}

function escapeMarkdownText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '\\|');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value);
}

function orderSparseCountRecord<T extends string>(
  record: Partial<Record<T, number>>,
): Partial<Record<T, number>> {
  const entries: Array<[T, number]> = [];
  const orderedKeys = Object.keys(record)
    .filter((key): key is T => KNOWN_LANGUAGE_ORDER.includes(key as DetectedLanguage) || key.length > 0)
    .sort((left, right) => left.localeCompare(right, 'en'));

  for (const key of orderedKeys) {
    entries.push([key, record[key] ?? 0]);
  }

  return Object.fromEntries(entries) as Partial<Record<T, number>>;
}
