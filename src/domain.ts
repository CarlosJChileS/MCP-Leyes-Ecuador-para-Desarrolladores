export type LegalStatus = 'vigente' | 'reformado' | 'derogado' | 'pendiente_verificacion';
export type LegalEventType = 'publicacion' | 'reforma' | 'derogacion' | 'sustitucion' | 'reglamento' | 'resolucion';
export type LegalHistoryEvent = { type: LegalEventType; date?: string; officialGazette?: string; title: string; sourceUrl: string; notes?: string };
export type LegalSource = { id: string; title: string; type: string; issuer: string; jurisdiction: 'Ecuador'; publishedAt: string; verifiedAt: string; status: LegalStatus; url: string; topics: string[]; summary?: string; officialGazette?: { number?: string; edition?: string; page?: string }; history?: LegalHistoryEvent[]; relatedSourceIds?: string[]; verification?: { urlCheckedAt?: string; documentaryReviewedAt?: string; legalReviewedAt?: string; reviewer?: string; notes?: string } };
export function validateLegalSource(source: unknown): source is LegalSource {
  if (!source || typeof source !== 'object') throw new Error('La fuente debe ser un objeto');
  const s = source as Record<string, unknown>;
  if (typeof s.id !== 'string' || !s.id.trim() || typeof s.title !== 'string' || !s.title.trim() || typeof s.type !== 'string' || typeof s.issuer !== 'string' || !s.issuer.trim() || s.jurisdiction !== 'Ecuador') throw new Error('Faltan campos obligatorios de la fuente');
  if (typeof s.url !== 'string') throw new Error('La fuente debe usar una URL HTTPS');
  try { const url = new URL(s.url); if (url.protocol !== 'https:') throw new Error(); } catch { throw new Error('La fuente debe usar una URL HTTPS'); }
  if (!['vigente', 'reformado', 'derogado', 'pendiente_verificacion'].includes(String(s.status))) throw new Error('Estado normativo inválido');
  const validDate = (value: unknown) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if (!validDate(s.publishedAt) || !validDate(s.verifiedAt)) throw new Error('Las fechas deben usar YYYY-MM-DD');
  if (!Array.isArray(s.topics) || s.topics.some((t) => typeof t !== 'string')) throw new Error('Los temas deben ser texto');
  if (s.history !== undefined && (!Array.isArray(s.history) || s.history.some((event) => !event || typeof event !== 'object' || typeof (event as Record<string, unknown>).title !== 'string' || typeof (event as Record<string, unknown>).sourceUrl !== 'string'))) throw new Error('El historial normativo es inválido');
  return true;
}
