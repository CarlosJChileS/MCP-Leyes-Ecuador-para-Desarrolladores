import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { LegalSource } from './domain.js';
import type { AuditReport } from './audit.js';
import type { DependencyScanReport } from './dependencies.js';
import {
  assessDataTransfer,
  evaluateDataGovernance,
  generateDataInventory,
  generateImpactAssessment,
  generateResponsibilityMatrix,
  type GovernanceProfile,
} from './governance.js';

export type RemediationAction = {
  id: string;
  area: string;
  problem: string;
  whyItMatters: string;
  priority: 'critica' | 'alta' | 'media' | 'baja';
  suggestedOwner: string;
  steps: string[];
  expectedEvidence: string[];
  completionCriteria: string;
};

function buildRemediationPlan(
  profile: GovernanceProfile,
  governance: ReturnType<typeof evaluateDataGovernance>,
  inventory: ReturnType<typeof generateDataInventory>,
  transfers: ReturnType<typeof assessDataTransfer>,
  impact: ReturnType<typeof generateImpactAssessment>,
  responsibilities: ReturnType<typeof generateResponsibilityMatrix>,
  technicalAudit?: AuditReport,
  dependencyAudit?: DependencyScanReport,
): RemediationAction[] {
  const actions: RemediationAction[] = [];
  let sequence = 1;
  const add = (action: Omit<RemediationAction, 'id'>) => actions.push({ id: `GOV-${String(sequence++).padStart(3, '0')}`, ...action });

  for (const gap of governance.gaps) add({
    area: 'Gobernanza general', problem: gap,
    whyItMatters: 'Sin esta definición no es posible demostrar control, responsabilidad ni aplicación consistente durante el ciclo de vida de los datos.',
    priority: 'alta', suggestedOwner: 'Responsable de gobernanza de datos',
    steps: ['Designar un responsable y participantes técnicos.', 'Documentar el estado actual con los equipos que crean, consultan, comparten y eliminan datos.', 'Aprobar la definición y vincularla con procedimientos operativos.', 'Programar una revisión periódica y conservar el historial de cambios.'],
    expectedEvidence: ['documento aprobado y versionado', 'responsable y fecha de aprobación', 'procedimiento asociado', 'registro de revisiones'],
    completionCriteria: 'La definición está aprobada, tiene responsable, se aplica a los sistemas declarados y cuenta con evidencia verificable.',
  });

  for (const item of governance.coverage.filter(item => item.status === 'pendiente_catalogo')) add({
    area: `Cobertura normativa: ${item.domain}`,
    problem: `No existe una fuente catalogada que cubra el dominio «${item.domain}».`,
    whyItMatters: 'La ausencia de una fuente impide justificar obligaciones, excepciones, controles y vigencia aplicables a este dominio.',
    priority: 'media', suggestedOwner: 'Especialista jurídico con apoyo del responsable de datos',
    steps: ['Consultar Registro Oficial y la entidad sectorial competente.', 'Identificar ley, reglamento, resolución, reformas y derogaciones aplicables.', 'Registrar cita exacta, edición, suplemento, fecha, página, artículo y URL oficial.', 'Incorporar la fuente inicialmente como pendiente_verificacion.', 'Exigir revisión humana, reviewer y legalReviewedAt antes de confirmar su estado.'],
    expectedEvidence: ['URL oficial accesible o copia oficial trazable', 'ficha bibliográfica del Registro Oficial', 'historial de reformas y derogaciones', 'revisión jurídica identificada'],
    completionCriteria: `El dominio «${item.domain}» tiene al menos una fuente oficial catalogada, trazable y revisada; si no existe norma específica, queda documentado el análisis de no aplicabilidad.`,
  });

  if (inventory.fields.length === 0) add({
    area: 'Inventario de datos', problem: 'No se declararon categorías de datos para construir el inventario.',
    whyItMatters: 'Sin inventario no se conocen ubicación, finalidad, accesos, transferencias, retención ni exposición de los datos.',
    priority: 'alta', suggestedOwner: 'Custodio de datos y líder de ingeniería',
    steps: ['Descubrir datos en formularios, APIs, bases de datos, archivos, logs, analítica y respaldos.', 'Clasificar datos personales, sensibles, públicos, confidenciales y técnicos.', 'Registrar finalidad, origen, sistema, responsable, destinatarios y base jurídica por categoría.', 'Validar el inventario con privacidad, seguridad y dueños del proceso.'],
    expectedEvidence: ['inventario versionado', 'diccionario de datos', 'mapa de flujos', 'acta o aprobación de responsables'],
    completionCriteria: 'Todos los sistemas y flujos en alcance están asociados a categorías de datos con propietario, finalidad y ubicación identificados.',
  });

  if (inventory.fields.some(field => field.purpose.includes('pendiente') || field.source.includes('pendiente') || field.access.includes('pendiente'))) add({
    area: 'Calidad del inventario', problem: 'El inventario contiene finalidades, orígenes, accesos o reglas de calidad pendientes.',
    whyItMatters: 'Campos incompletos producen decisiones erróneas de acceso, conservación, eliminación y cumplimiento.',
    priority: 'alta', suggestedOwner: 'Custodio de datos',
    steps: ['Completar cada campo pendiente con información del sistema real.', 'Definir reglas medibles de exactitud, completitud, actualidad, unicidad y consistencia.', 'Asignar acceso por rol y mínimo privilegio.', 'Definir validaciones automáticas y tratamiento de excepciones.'],
    expectedEvidence: ['inventario sin marcadores pendientes', 'reglas de calidad medibles', 'matriz de acceso', 'resultados de controles automáticos'],
    completionCriteria: 'Cada categoría declarada posee finalidad, origen, responsable, acceso, calidad, retención y evidencia de eliminación completas.',
  });

  if (profile.sharesExternally || profile.internationalTransfers) add({
    area: 'Transferencias de datos', problem: `La transferencia está clasificada como ${transfers.status}.`,
    whyItMatters: 'Compartir datos sin identificar participantes, destino, garantías y medidas puede generar acceso indebido y responsabilidades no controladas.',
    priority: profile.internationalTransfers ? 'critica' : 'alta', suggestedOwner: 'Privacidad, jurídico y seguridad de la información',
    steps: ['Mapear exportador, importador, destinatarios, subencargados, países y rutas técnicas.', 'Documentar categorías, finalidad, necesidad y base jurídica.', 'Evaluar jurisdicción de destino y garantías exigibles.', 'Formalizar contrato, instrucciones, medidas de seguridad, incidentes, devolución y eliminación.', 'Aprobar jurídicamente antes de activar el flujo y revisar a los proveedores periódicamente.'],
    expectedEvidence: ['registro de transferencias', 'diagrama de flujo', 'evaluación del país y proveedor', 'contrato y anexos de seguridad', 'aprobación jurídica'],
    completionCriteria: 'Ninguna transferencia opera sin registro completo, garantías aprobadas, controles técnicos probados y responsables identificados.',
  });

  if (impact.riskLevel === 'alto_o_requiere_revision') add({
    area: 'Evaluación de impacto', problem: 'Se detectaron factores de riesgo alto o que requieren revisión formal.',
    whyItMatters: 'Los tratamientos de alto riesgo pueden afectar derechos y requieren justificar necesidad, proporcionalidad y reducción del riesgo antes del despliegue.',
    priority: 'critica', suggestedOwner: 'Delegado de protección de datos o privacidad con seguridad e ingeniería',
    steps: ['Describir alcance, datos, titulares, tecnologías, decisiones y flujos.', 'Evaluar necesidad, proporcionalidad y alternativas menos invasivas.', 'Identificar amenazas, impactos, probabilidad y riesgo inherente.', 'Definir controles y calcular riesgo residual.', 'Obtener aprobación independiente y bloquear producción si el riesgo residual no es aceptable.', 'Reevaluar ante cambios sustanciales o incidentes.'],
    expectedEvidence: ['evaluación de impacto firmada', 'matriz de riesgos', 'pruebas de controles', 'aceptación del riesgo residual', 'registro de revisiones'],
    completionCriteria: 'La evaluación está aprobada antes de producción y cada riesgo alto tiene control, dueño, plazo y evidencia de eficacia.',
  });

  for (const role of responsibilities.missing) add({
    area: 'Responsabilidades', problem: `El rol «${role}» no tiene una persona o función asignada.`,
    whyItMatters: 'Una obligación sin responsable tiende a quedar sin ejecución, evidencia, escalamiento ni seguimiento.',
    priority: role.includes('privacidad') || role.includes('seguridad') ? 'alta' : 'media', suggestedOwner: 'Dirección o patrocinador del proyecto',
    steps: [`Designar a la persona o unidad responsable de ${role}.`, 'Definir responsabilidades, autoridad, suplencia y escalamiento.', 'Separar funciones incompatibles y registrar responsables de aprobación y ejecución.', 'Comunicar la asignación y revisar su vigencia periódicamente.'],
    expectedEvidence: ['matriz RACI aprobada', 'nombramiento o asignación formal', 'descripción de funciones', 'registro de aceptación'],
    completionCriteria: `El rol «${role}» está formalmente asignado y su responsable puede demostrar ejecución y conservación de evidencias.`,
  });

  for (const finding of technicalAudit?.findings ?? []) add({
    area: `Código y seguridad: ${finding.ruleId}`,
    problem: `${finding.explanation} Ubicación: ${finding.path}:${finding.line}.`,
    whyItMatters: `Severidad ${finding.severity}. ${finding.reference.rationale}`,
    priority: finding.severity === 'critical' ? 'critica' : finding.severity === 'high' ? 'alta' : finding.severity === 'medium' ? 'media' : 'baja',
    suggestedOwner: finding.category === 'documentacion' ? 'Responsable de cumplimiento y documentación' : 'Líder de ingeniería y seguridad',
    steps: ['Confirmar el hallazgo revisando el archivo y el flujo completo; registrar falso positivo si corresponde.', finding.recommendation, 'Añadir o actualizar una prueba automatizada que impida la regresión.', 'Revisar usos equivalentes en el resto del repositorio.', 'Solicitar revisión técnica y conservar evidencia del cambio.'],
    expectedEvidence: [`cambio revisado en ${finding.path}`, 'prueba automatizada aprobada', 'resultado de reescaneo sin el hallazgo', `referencia jurídica o técnica: ${finding.reference.title}`],
    completionCriteria: `El hallazgo ${finding.id} no aparece en un nuevo escaneo o está justificado, aprobado y documentado como excepción.`,
  });

  for (const finding of dependencyAudit?.findings ?? []) add({
    area: `Dependencias: ${finding.packageName}`,
    problem: `${finding.summary}. Versión detectada: ${finding.installedVersion ?? 'no determinada'}; versión corregida: ${finding.fixedVersion ?? 'no informada'}.`,
    whyItMatters: `La dependencia presenta una vulnerabilidad de severidad ${finding.severity}; mantenerla puede exponer el proyecto aunque el código propio no contenga el defecto.`,
    priority: finding.severity === 'critical' ? 'critica' : finding.severity === 'high' ? 'alta' : finding.severity === 'medium' ? 'media' : 'baja',
    suggestedOwner: 'Líder de ingeniería y seguridad de aplicaciones',
    steps: [`Confirmar el aviso ${finding.advisoryId ?? finding.id} en su fuente oficial.`, finding.fixedVersion ? `Actualizar ${finding.packageName} a ${finding.fixedVersion} o superior compatible.` : 'Identificar una versión corregida, mitigación oficial o dependencia alternativa.', 'Actualizar el lockfile con el gestor del proyecto.', 'Ejecutar pruebas funcionales, de seguridad y compatibilidad.', 'Volver a escanear dependencias y documentar cualquier riesgo aceptado.'],
    expectedEvidence: ['manifiesto y lockfile actualizados', 'pruebas aprobadas', 'resultado del escáner sin la vulnerabilidad', 'aprobación documentada si existe una excepción temporal'],
    completionCriteria: `La vulnerabilidad de ${finding.packageName} ya no aparece en el escáner o tiene una mitigación temporal aprobada, con dueño y fecha límite.`,
  });
  return actions;
}

export function buildGovernanceReport(profile: GovernanceProfile, sources: LegalSource[], audits: { technical?: AuditReport; dependencies?: DependencyScanReport } = {}) {
  const governance = evaluateDataGovernance(profile, sources);
  const inventory = generateDataInventory(profile);
  const transfers = assessDataTransfer(profile, sources);
  const impactAssessment = generateImpactAssessment(profile, sources);
  const responsibilities = generateResponsibilityMatrix(profile);
  const remediationPlan = buildRemediationPlan(profile, governance, inventory, transfers, impactAssessment, responsibilities, audits.technical, audits.dependencies);

  return {
    schemaVersion: 1 as const,
    generatedAt: new Date().toISOString(),
    executiveSummary: {
      project: profile.name,
      maturity: governance.maturity,
      totalDomains: governance.coverageSummary.totalDomains,
      coveredDomains: governance.coverageSummary.coveredDomains,
      pendingDomains: governance.coverageSummary.pendingDomains,
      evidenceRequired: governance.requiredEvidence.length,
      governanceGaps: governance.gaps.length,
      transferStatus: transfers.status,
      impactRiskLevel: impactAssessment.riskLevel,
      unassignedRoles: responsibilities.missing.length,
      totalActions: remediationPlan.length,
      criticalActions: remediationPlan.filter(action => action.priority === 'critica').length,
      highPriorityActions: remediationPlan.filter(action => action.priority === 'alta').length,
      complianceScore: governance.coverageSummary.totalDomains ? Math.round((governance.coverageSummary.coveredDomains / governance.coverageSummary.totalDomains) * 100) : 0,
    },
    sections: { governance, inventory, transfers, impactAssessment, responsibilities, technicalAudit: audits.technical, dependencyAudit: audits.dependencies },
    remediationPlan,
    disclaimer: governance.disclaimer,
  };
}

export type GovernanceReport = ReturnType<typeof buildGovernanceReport>;

const safe = (value: unknown) => String(value ?? '—');
const list = (values: readonly unknown[]) => values.length ? values.map(value => `- ${safe(value)}`).join('\n') : '- Ninguno declarado';

export function renderGovernanceReportMarkdown(report: GovernanceReport): string {
  const { executiveSummary: summary, sections } = report;
  const coverage = sections.governance.coverage.map(item =>
    `| ${item.domain} | ${item.status} | ${item.sourceIds.join(', ') || '—'} |`,
  ).join('\n');
  const inventory = sections.inventory.fields.map(item =>
    `| ${item.dataType} | ${item.owner} | ${item.systems.join(', ') || '—'} | ${item.retentionDays ?? '—'} |`,
  ).join('\n') || '| — | — | — | — |';
  const roles = sections.responsibilities.matrix.map(item =>
    `| ${item.role} | ${item.owner} | ${item.responsibilities.join('; ')} |`,
  ).join('\n');

  return `# Informe de gobernanza de datos: ${summary.project}

Generado: ${report.generatedAt}  
Versión del esquema: ${report.schemaVersion}

## Resumen ejecutivo

- Madurez: ${summary.maturity}
- Cobertura: ${summary.coveredDomains}/${summary.totalDomains} dominios; ${summary.pendingDomains} pendientes
- Brechas detectadas: ${summary.governanceGaps}
- Evidencias requeridas: ${summary.evidenceRequired}
- Riesgo de impacto: ${summary.impactRiskLevel}
- Estado de transferencias: ${summary.transferStatus}
- Roles sin asignar: ${summary.unassignedRoles}
- Acciones correctivas: ${summary.totalActions} (${summary.criticalActions} críticas; ${summary.highPriorityActions} altas)

## Evaluación de gobernanza

| Dominio | Estado | Fuentes |
|---|---|---|
${coverage}

### Brechas

${list(sections.governance.gaps)}

### Evidencias requeridas

${list(sections.governance.requiredEvidence)}

## Inventario de datos

| Tipo de dato | Responsable | Sistemas | Retención (días) |
|---|---|---|---:|
${inventory}

Campos que deben completarse:

${list(sections.inventory.missing)}

## Transferencias de datos

- Tipo: ${sections.transfers.transferType}
- Estado: ${sections.transfers.status}

Lista de verificación:

${list(sections.transfers.checklist)}

## Evaluación de impacto

- Nivel de riesgo: ${sections.impactAssessment.riskLevel}
- Decisiones automatizadas: ${sections.impactAssessment.triggers.automatedDecisions ? 'sí' : 'no'}
- Transferencias internacionales: ${sections.impactAssessment.triggers.internationalTransfers ? 'sí' : 'no'}
- Categorías sensibles: ${sections.impactAssessment.triggers.sensitiveCategories ? 'sí' : 'no'}

Secciones requeridas:

${list(sections.impactAssessment.requiredSections)}

## Matriz de responsabilidades

| Rol | Responsable | Responsabilidades |
|---|---|---|
${roles}

## Auditoría técnica del repositorio

${sections.technicalAudit ? `- Ruta: ${sections.technicalAudit.summary.rootPath}
- Archivos analizados: ${sections.technicalAudit.summary.scannedFiles}
- Directorios analizados: ${sections.technicalAudit.summary.scannedDirectories}
- Entradas omitidas: ${sections.technicalAudit.summary.skippedEntries}
- Hallazgos: ${sections.technicalAudit.summary.totalFindings}

${sections.technicalAudit.findings.map(finding => `- [${finding.severity}] ${finding.ruleId} — ${finding.path}:${finding.line}: ${finding.explanation}`).join('\n') || '- No se detectaron hallazgos con las reglas disponibles.'}` : '- No se solicitó una ruta de repositorio; el código no fue analizado.'}

## Auditoría de dependencias

${sections.dependencyAudit ? `- Hallazgos: ${sections.dependencyAudit.summary.totalFindings}
- Escáneres completados: ${sections.dependencyAudit.summary.scannersByStatus.completed}
- Escáneres no disponibles: ${sections.dependencyAudit.summary.scannersByStatus.unavailable}

${sections.dependencyAudit.findings.map(finding => `- [${finding.severity}] ${finding.packageName} ${finding.installedVersion ?? ''}: ${finding.summary}`).join('\n') || '- No se reportaron vulnerabilidades; esto no garantiza su ausencia.'}

Advertencias:
${list(sections.dependencyAudit.warnings.map(warning => `${warning.scanner}: ${warning.message}`))}` : '- El escaneo de dependencias no fue solicitado.'}

## Plan detallado de solución

${report.remediationPlan.map(action => `### ${action.id} — ${action.area}

**Problema:** ${action.problem}

**Por qué importa:** ${action.whyItMatters}

**Prioridad:** ${action.priority}  
**Responsable sugerido:** ${action.suggestedOwner}

**Cómo solucionarlo**

${action.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

**Evidencia esperada**

${list(action.expectedEvidence)}

**Criterio de cierre:** ${action.completionCriteria}`).join('\n\n')}

## Fuentes y limitaciones

${list(sections.governance.references.map(reference => `${reference.title} (${reference.id}): ${reference.url} — estado ${reference.status}, verificada ${reference.verifiedAt}`))}

> ${report.disclaimer}
`;
}

const escapeHtml = (value: unknown) => safe(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

export function renderGovernanceReportHtml(report: GovernanceReport): string {
  const markdown = renderGovernanceReportMarkdown(report);
  const body = markdown.split('\n').map(line => {
    if (line.startsWith('# ')) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
    if (line.startsWith('## ')) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
    if (line.startsWith('### ')) return `<h3>${escapeHtml(line.slice(4))}</h3>`;
    if (line.startsWith('- ')) return `<div class="item">• ${escapeHtml(line.slice(2))}</div>`;
    if (line.startsWith('> ')) return `<aside>${escapeHtml(line.slice(2))}</aside>`;
    if (line.startsWith('|')) return `<pre>${escapeHtml(line)}</pre>`;
    return line ? `<p>${escapeHtml(line)}</p>` : '';
  }).join('\n');
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(report.executiveSummary.project)} — Gobernanza de datos</title><style>@page { size: A4; margin: 18mm; } body{font:14px/1.5 system-ui,sans-serif;color:#172033;max-width:900px;margin:auto}h1,h2,h3{color:#123c69;break-after:avoid}h2{border-bottom:2px solid #d7e2ee;padding-bottom:.25rem}pre{font:12px/1.35 ui-monospace,monospace;white-space:pre-wrap;margin:.15rem 0}.item{margin:.2rem 0}aside{margin-top:2rem;padding:1rem;background:#f3f6f9;border-left:4px solid #627d98}p{margin:.35rem 0}@media print{body{max-width:none}h2{break-before:auto}}</style></head><body>${body}</body></html>`;
}

function wrapText(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of text.replace(/[—•]/g, '-').split('\n')) {
    let current = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) current = candidate;
      else { if (current) lines.push(current); current = word; }
    }
    lines.push(current);
  }
  return lines;
}

export async function renderGovernanceReportPdf(report: GovernanceReport): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 48;
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  const markdown = renderGovernanceReportMarkdown(report);
  for (const raw of markdown.split('\n')) {
    const heading = raw.startsWith('#');
    const clean = raw.replace(/^#{1,3}\s+/, '').replace(/^>\s*/, '').replace(/^\|/, '').replace(/\|$/, '').replace(/\|/g, ' | ');
    const size = raw.startsWith('# ') ? 18 : raw.startsWith('## ') ? 14 : raw.startsWith('### ') ? 12 : 9;
    const selectedFont = heading ? bold : font;
    const lines = wrapText(clean || ' ', selectedFont, size, pageWidth - margin * 2);
    const lineHeight = size * 1.35;
    for (const line of lines) {
      if (y < margin + lineHeight) { page = pdf.addPage([pageWidth, pageHeight]); y = pageHeight - margin; }
      page.drawText(line, { x: margin, y, size, font: selectedFont, color: heading ? rgb(0.07, 0.24, 0.41) : rgb(0.09, 0.13, 0.2) });
      y -= lineHeight;
    }
    y -= heading ? 5 : 2;
  }
  pdf.setTitle(`Informe de gobernanza de datos: ${report.executiveSummary.project}`);
  pdf.setSubject('Evaluación consolidada de gobernanza de datos y leyes tecnológicas de Ecuador');
  pdf.setCreator('eculegaldev');
  return pdf.save();
}
