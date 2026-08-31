export type LegalStatus = 'vigente' | 'reformado' | 'derogado' | 'pendiente_verificacion';
export type LegalSource = { id: string; title: string; type: string; issuer: string; jurisdiction: 'Ecuador'; publishedAt: string; verifiedAt: string; status: LegalStatus; url: string; topics: string[]; summary?: string };
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
  return true;
}
