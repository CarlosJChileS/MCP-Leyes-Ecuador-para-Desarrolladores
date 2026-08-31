import type { LegalSource } from './domain.js';
export type ProjectProfile = { name: string; processesPersonalData?: boolean; usesProviders?: boolean; sellsOnline?: boolean; storesSensitiveData?: boolean };
export function assessProject(project: ProjectProfile, sources: LegalSource[]) {
  const risks: string[] = [], controls: string[] = [], questions: string[] = [];
  if (project.processesPersonalData) { risks.push('El proyecto trata datos personales y requiere identificar base jurídica, transparencia y medidas de seguridad.'); controls.push('Inventariar tratamientos, finalidades, responsables, encargados y plazos de conservación.'); }
  if (project.storesSensitiveData) { risks.push('El tratamiento de datos sensibles requiere controles reforzados y revisión especializada.'); controls.push('Aplicar minimización, control de acceso, cifrado y evaluación de impacto cuando corresponda.'); }
  if (project.usesProviders) { risks.push('Los proveedores que acceden a datos deben tener responsabilidades y garantías documentadas.'); controls.push('Formalizar contratos, instrucciones, subencargados, confidencialidad y gestión de incidentes.'); }
  if (project.sellsOnline) { risks.push('La venta digital requiere revisar información al consumidor, contratación y comprobantes aplicables.'); controls.push('Documentar términos, privacidad, devoluciones, soporte y evidencia de consentimiento.'); }
  if (!project.processesPersonalData && project.processesPersonalData !== false) questions.push('¿El sistema recolecta, consulta, almacena o comparte datos de personas?');
  if (!project.name?.trim()) throw new Error('El proyecto requiere un nombre');
  if (risks.length === 0) questions.push('¿Qué datos, usuarios, proveedores y canales de comercialización intervienen?');
  return { project: project.name, risks, controls, questions, references: sources.map(({ id, title, url, verifiedAt, status }) => ({ id, title, url, verifiedAt, status })), disclaimer: 'Orientación preliminar; no constituye dictamen ni certificación jurídica.' };
}
export function auditChecklist(project: ProjectProfile, sources: LegalSource[]) { const a = assessProject(project, sources); return { project: a.project, items: [...a.controls.map((text) => ({ text, evidence: 'Definir evidencia y responsable', status: 'pendiente' })), { text: 'Revisar fuentes y vigencia', evidence: a.references.map((r) => r.url).join(', '), status: 'pendiente' }], disclaimer: a.disclaimer }; }
