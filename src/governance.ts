import type { LegalSource } from './domain.js';
import type { Language } from './i18n.js';

export type GovernanceProfile = { name: string; dataTypes?: string[]; systems?: string[]; owners?: string[]; sharesExternally?: boolean; internationalTransfers?: boolean; publicData?: boolean; automatedDecisions?: boolean; retentionDays?: number; language?: Language };
const ref = (sources: LegalSource[], topics: string[]) => sources.filter(s => s.topics.some(t => topics.includes(t))).map(({ id, title, url, status, verifiedAt }) => ({ id, title, url, status, verifiedAt }));
const text = (language: Language, es: string, en: string) => language === 'en' ? en : es;
const GOVERNANCE_DOMAINS = [
  ['protección de datos personales', ['datos personales', 'privacidad']],
  ['datos públicos y abiertos', ['datos abiertos', 'transparencia']],
  ['transparencia y acceso a información', ['transparencia', 'acceso a información']],
  ['gobierno digital', ['gobierno digital', 'transformación digital']],
  ['interoperabilidad', ['interoperabilidad']],
  ['archivo y gestión documental', ['archivo', 'gestión documental']],
  ['seguridad de la información', ['seguridad']],
  ['ciberseguridad', ['ciberseguridad', 'delitos informáticos']],
  ['inteligencia artificial y decisiones automatizadas', ['inteligencia artificial', 'decisiones automatizadas']],
  ['banca y fintech', ['fintech', 'servicios financieros']],
  ['salud', ['salud']], ['educación', ['educación']], ['telecomunicaciones', ['telecomunicaciones']],
  ['comercio electrónico', ['comercio electrónico']], ['facturación electrónica', ['facturación electrónica']],
  ['propiedad intelectual', ['propiedad intelectual', 'software']], ['datos laborales', ['laboral']],
  ['datos tributarios', ['tributario']], ['datos geográficos', ['datos geográficos']],
  ['contratación pública', ['contratación pública']], ['gobiernos autónomos descentralizados', ['municipal', 'gobiernos autónomos']],
  ['jurisprudencia y criterios administrativos', ['jurisprudencia', 'criterios administrativos']],
] as const;

function governanceCoverage(sources: LegalSource[]) {
  return GOVERNANCE_DOMAINS.map(([domain, aliases]) => {
    const matching = sources.filter(source => source.topics.some(topic => aliases.some(alias => topic.toLowerCase().includes(alias))));
    return { domain, status: matching.length ? 'catalogado' as const : 'pendiente_catalogo' as const, sourceIds: matching.map(source => source.id) };
  });
}

export function evaluateDataGovernance(profile: GovernanceProfile, sources: LegalSource[]) {
  const language = profile.language ?? 'es';
  const coverage = governanceCoverage(sources);
  const pending = coverage.filter(item => item.status === 'pendiente_catalogo').map(item => item.domain);
  const gaps: string[] = [];
  if (!profile.dataTypes?.length) gaps.push(text(language, 'Falta clasificar las categorías de datos.', 'Data categories have not been classified.'));
  if (!profile.owners?.length) gaps.push(text(language, 'Faltan responsables, custodios y operadores.', 'Owners, custodians and operators are missing.'));
  if (!profile.retentionDays) gaps.push(text(language, 'Falta definir retención y eliminación.', 'Retention and deletion periods are missing.'));
  if (profile.sharesExternally && !profile.owners?.length) gaps.push(text(language, 'Compartir datos requiere contratos, instrucciones y trazabilidad.', 'External sharing requires contracts, instructions and traceability.'));
  return { project: profile.name, language, maturity: gaps.length === 0 ? 'inicial_con_evidencia_pendiente' : 'brechas_identificadas', coverage, coverageSummary: { totalDomains: coverage.length, coveredDomains: coverage.length - pending.length, pendingDomains: pending.length, pending }, gaps, requiredEvidence: ['inventario de datos', 'registro de tratamientos', 'matriz de responsables y custodios', 'clasificación y calidad', 'retención y eliminación', 'controles de acceso', 'registro de transferencias', 'gestión de incidentes', 'política de datos abiertos', 'matriz de interoperabilidad', 'archivo y trazabilidad', 'evaluación de proveedores y sectores regulados'], references: ref(sources, ['datos personales', 'privacidad', 'transferencias internacionales', 'transparencia']), disclaimer: text(language, 'Evaluación preliminar; no constituye certificación jurídica ni de cumplimiento.', 'Preliminary assessment; not a legal or compliance certification.') };
}

export function generateDataInventory(profile: GovernanceProfile) {
  const language = profile.language ?? 'es';
  return { project: profile.name, language, fields: (profile.dataTypes ?? []).map(dataType => ({ dataType, purpose: 'pendiente de documentar', source: 'pendiente de documentar', owner: profile.owners?.[0] ?? 'pendiente', systems: profile.systems ?? [], retentionDays: profile.retentionDays ?? null, access: 'pendiente de definir', qualityRules: 'pendiente de definir', deletionEvidence: 'pendiente de definir' })), missing: ['finalidad y base jurídica', 'origen', 'responsable', 'sistemas', 'retención', 'calidad', 'acceso', 'eliminación'], disclaimer: text(language, 'Plantilla de inventario; debe completarse con el tratamiento real.', 'Inventory template; complete it with actual processing details.') };
}

export function assessDataTransfer(profile: GovernanceProfile, sources: LegalSource[]) {
  const language = profile.language ?? 'es';
  const international = Boolean(profile.internationalTransfers);
  return { project: profile.name, language, transferType: international ? 'internacional' : 'nacional_o_no_declarada', status: international ? 'requiere_revision_juridica_y_documental' : 'documentar_si_aplica', checklist: ['exportador e importador', 'categorías de datos', 'finalidad y base jurídica', 'país de destino', 'garantías y contrato', 'subencargados', 'medidas de seguridad', 'registro y evidencia'], references: ref(sources, ['transferencias internacionales', 'datos personales']), disclaimer: text(language, 'No determina por sí sola la legalidad de la transferencia.', 'Does not by itself determine transfer legality.') };
}

export function generateImpactAssessment(profile: GovernanceProfile, sources: LegalSource[]) {
  const language = profile.language ?? 'es';
  const highRisk = Boolean(profile.automatedDecisions || profile.internationalTransfers || profile.dataTypes?.some(t => /salud|biométr|niñ|menor|financ/i.test(t)));
  return { project: profile.name, language, riskLevel: highRisk ? 'alto_o_requiere_revision' : 'por_determinar', triggers: { automatedDecisions: Boolean(profile.automatedDecisions), internationalTransfers: Boolean(profile.internationalTransfers), sensitiveCategories: Boolean(profile.dataTypes?.some(t => /salud|biométr|niñ|menor|financ/i.test(t))) }, requiredSections: ['descripción del tratamiento', 'necesidad y proporcionalidad', 'riesgos para titulares', 'medidas técnicas y organizativas', 'consulta y aprobación', 'plan de seguimiento'], references: ref(sources, ['datos personales', 'seguridad', 'transferencias internacionales']), disclaimer: text(language, 'Preclasificación de riesgo; no sustituye una evaluación jurídica o de impacto formal.', 'Risk pre-classification; does not replace a formal legal or impact assessment.') };
}

export function generateResponsibilityMatrix(profile: GovernanceProfile) {
  const language = profile.language ?? 'es';
  const roles = ['responsable del tratamiento', 'encargado', 'custodio de datos', 'seguridad', 'privacidad', 'ingeniería', 'auditoría'];
  return { project: profile.name, language, matrix: roles.map(role => ({ role, owner: profile.owners?.find(owner => owner.toLowerCase().includes(role.split(' ')[0])) ?? 'pendiente de asignar', responsibilities: ['definir alcance', 'aprobar controles', 'conservar evidencia', 'gestionar incidentes'] })), missing: roles.filter(role => !(profile.owners ?? []).some(owner => owner.toLowerCase().includes(role.split(' ')[0]))), disclaimer: text(language, 'Matriz inicial; asignar responsables reales y aprobarla formalmente.', 'Initial matrix; assign real owners and formally approve it.') };
}
