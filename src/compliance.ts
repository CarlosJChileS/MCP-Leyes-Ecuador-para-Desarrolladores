import type { LegalSource } from './domain.js';
import { type Language, localized } from './i18n.js';
export type ProjectProfile = { name: string; processesPersonalData?: boolean; usesProviders?: boolean; sellsOnline?: boolean; storesSensitiveData?: boolean; handlesPayments?: boolean; issuesInvoices?: boolean; internationalTransfers?: boolean; hasEmployees?: boolean; hasMinors?: boolean };
export type ComplianceStatus = 'pendiente' | 'en_progreso' | 'cumple' | 'no_cumple' | 'no_aplica' | 'aceptada_temporalmente' | 'requiere_revision_legal';
export type CompliancePriority = 'critica' | 'alta' | 'media' | 'baja';
export function assessProject(project: ProjectProfile, sources: LegalSource[], language: Language = 'es') {
  const risks: string[] = [], controls: string[] = [], questions: string[] = [];
  if (project.processesPersonalData) { risks.push(localized(language, 'El proyecto trata datos personales y requiere identificar base jurídica, transparencia y medidas de seguridad.', 'The project processes personal data and requires a legal basis, transparency, and security measures.')); controls.push(localized(language, 'Inventariar tratamientos, finalidades, responsables, encargados y plazos de conservación.', 'Inventory processing activities, purposes, controllers, processors, and retention periods.')); }
  if (project.storesSensitiveData) { risks.push(localized(language, 'El tratamiento de datos sensibles requiere controles reforzados y revisión especializada.', 'Processing sensitive data requires enhanced controls and specialist review.')); controls.push(localized(language, 'Aplicar minimización, control de acceso, cifrado y evaluación de impacto cuando corresponda.', 'Apply minimization, access control, encryption, and an impact assessment where applicable.')); }
  if (project.usesProviders) { risks.push(localized(language, 'Los proveedores que acceden a datos deben tener responsabilidades y garantías documentadas.', 'Providers accessing data must have documented responsibilities and safeguards.')); controls.push(localized(language, 'Formalizar contratos, instrucciones, subencargados, confidencialidad y gestión de incidentes.', 'Formalize contracts, instructions, subprocessors, confidentiality, and incident management.')); }
  if (project.sellsOnline) { risks.push(localized(language, 'La venta digital requiere revisar información al consumidor, contratación y comprobantes aplicables.', 'Digital sales require reviewing consumer information, contracting, and applicable receipts.')); controls.push(localized(language, 'Documentar términos, privacidad, devoluciones, soporte y evidencia de consentimiento.', 'Document terms, privacy, returns, support, and consent evidence.')); }
  if (project.handlesPayments || project.issuesInvoices) { risks.push(localized(language, 'Los pagos o comprobantes requieren revisar obligaciones tributarias, seguridad y conservación documental según el modelo real.', 'Payments or invoices require reviewing tax, security, and document-retention obligations for the actual model.')); controls.push(localized(language, 'Definir proveedor, trazabilidad, controles antifraude y conservación de comprobantes.', 'Define provider, traceability, anti-fraud controls, and invoice retention.')); }
  if (!project.processesPersonalData && project.processesPersonalData !== false) questions.push(localized(language, '¿El sistema recolecta, consulta, almacena o comparte datos de personas?', 'Does the system collect, access, store, or share personal data?'));
  if (!project.name?.trim()) throw new Error(localized(language, 'El proyecto requiere un nombre', 'The project requires a name'));
  if (risks.length === 0) questions.push(localized(language, '¿Qué datos, usuarios, proveedores y canales de comercialización intervienen?', 'Which data, users, providers, and sales channels are involved?'));
  const topics = new Set<string>();
  if (project.processesPersonalData || project.storesSensitiveData || project.usesProviders) { topics.add('datos personales'); topics.add('privacidad'); }
  if (project.sellsOnline) { topics.add('comercio electrónico'); topics.add('consumidores'); topics.add('facturación electrónica'); }
  const relevant = sources.filter(source => source.topics.some(topic => topics.has(topic)));
  const obligations = relevant.flatMap(source => (source.obligations ?? []).map(obligation => ({
    id: `${source.id}:${obligation.id}`,
    normId: source.id,
    normTitle: source.title,
    article: obligation.article,
    requirement: obligation.requirement[language],
    whyItApplies: obligation.appliesWhen[language],
    evidence: obligation.evidence.map(item => item[language]),
    sourceUrl: obligation.sourceUrl,
    status: (source.status === 'pendiente_verificacion' ? 'requiere_revision_legal' : 'pendiente') as ComplianceStatus,
    priority: (source.topics.includes('datos personales') || source.topics.includes('privacidad') ? 'alta' : 'media') as CompliancePriority,
    risk: localized(language, 'Riesgo de tratamiento sin controles o evidencia suficiente.', 'Risk of processing without sufficient controls or evidence.'),
    owner: localized(language, 'Responsable del proyecto', 'Project owner'),
    dueDate: null,
    gap: localized(language, 'No se ha registrado evidencia de cumplimiento.', 'No compliance evidence has been recorded.'),
    closureCriterion: localized(language, 'Registrar la evidencia indicada y completar una revisión legal y técnica.', 'Record the indicated evidence and complete legal and technical review.'),
  })));
  return { project: project.name, language, risks, controls, questions, references: relevant.map(({ id, title, url, verifiedAt, status, summary }) => ({ id, title, url, verifiedAt, status, summary })), obligations, disclaimer: localized(language, 'Orientación preliminar; no constituye dictamen ni certificación jurídica.', 'Preliminary guidance; this is not a legal opinion or certification.') };
}
export function auditChecklist(project: ProjectProfile, sources: LegalSource[], language: Language = 'es') { const a = assessProject(project, sources, language); return { project: a.project, language, items: [...a.obligations.map((obligation) => ({ id: obligation.id, text: obligation.requirement, norm: obligation.normTitle, article: obligation.article, whyItApplies: obligation.whyItApplies, evidence: obligation.evidence, gap: obligation.gap, status: obligation.status, priority: obligation.priority, risk: obligation.risk, owner: obligation.owner, dueDate: obligation.dueDate, closureCriterion: obligation.closureCriterion, sourceUrl: obligation.sourceUrl })), ...a.controls.map((text) => ({ text, evidence: localized(language, 'Definir evidencia y responsable', 'Define evidence and owner'), status: 'pendiente' as const, priority: 'media' as const })), { text: localized(language, 'Revisar fuentes y vigencia', 'Review sources and legal status'), evidence: a.references.map((r) => r.url).join(', '), status: 'requiere_revision_legal' as const, priority: 'alta' as const }], disclaimer: a.disclaimer }; }
