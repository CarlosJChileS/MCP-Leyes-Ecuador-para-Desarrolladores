export type LegalStatus = 'vigente' | 'reformado' | 'derogado' | 'pendiente_verificacion';
export type LegalSource = { id: string; title: string; type: string; issuer: string; jurisdiction: 'Ecuador'; publishedAt: string; verifiedAt: string; status: LegalStatus; url: string; topics: string[]; summary?: string };
export function validateLegalSource(source: unknown): source is LegalSource {
  if (!source || typeof source !== 'object') throw new Error('La fuente debe ser un objeto');
  const s = source as Record<string, unknown>;
  if (typeof s.id !== 'string' || typeof s.title !== 'string' || typeof s.issuer !== 'string' || s.jurisdiction !== 'Ecuador') throw new Error('Faltan campos obligatorios de la fuente');
  if (typeof s.url !== 'string' || !s.url.startsWith('https://')) throw new Error('La fuente debe usar una URL HTTPS');
  if (!['vigente', 'reformado', 'derogado', 'pendiente_verificacion'].includes(String(s.status))) throw new Error('Estado normativo inválido');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s.publishedAt)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(s.verifiedAt))) throw new Error('Las fechas deben usar YYYY-MM-DD');
  if (!Array.isArray(s.topics) || s.topics.some((t) => typeof t !== 'string')) throw new Error('Los temas deben ser texto');
  return true;
}
