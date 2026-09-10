import { describe, expect, it } from 'vitest';
import { LegalCatalog } from '../src/catalog.js';
describe('LegalCatalog', () => {
  it('loads and searches verified sources', async () => { const c = await LegalCatalog.load(); const results = c.search('datos personales'); expect(results.length).toBeGreaterThan(0); expect(results[0].url.startsWith('https://')).toBe(true); });
  it('covers the fundamental developer-relevant legal domains', async () => {
    const titles = new Set((await LegalCatalog.load()).all().map((source) => source.title));
    expect([...titles].some((title) => title.includes('Constitución'))).toBe(true);
    expect([...titles].some((title) => title.includes('Código del Trabajo'))).toBe(true);
    expect([...titles].some((title) => title.includes('Código Tributario'))).toBe(true);
    expect([...titles].some((title) => title.includes('Ley de Compañías'))).toBe(true);
    expect([...titles].some((title) => title.includes('sector financiero'))).toBe(true);
    expect([...titles].some((title) => title.includes('sector salud'))).toBe(true);
    expect([...titles].some((title) => title.includes('sector educativo'))).toBe(true);
  });
  it('requires actionable metadata for enriched legal groups', async () => {
    const ids = ['comercio-electronico', 'propiedad-intelectual', 'telecomunicaciones', 'coip-delitos-informaticos', 'codigo-trabajo', 'ley-companias', 'fintech', 'marco-sector-financiero', 'marco-sector-salud', 'marco-sector-educativo', 'facturacion-electronica-sri', 'defensa-consumidor'];
    const sources = await LegalCatalog.load();
    for (const id of ids) {
      const source = sources.get(id);
      expect(source?.obligations?.length, id).toBeGreaterThan(0);
      for (const obligation of source?.obligations ?? []) {
        expect(obligation.article.length).toBeGreaterThan(0);
        expect(obligation.sourceUrl.startsWith('https://')).toBe(true);
        expect(obligation.evidence.length).toBeGreaterThan(0);
        expect(obligation.documentaryReviewedAt).toMatch(/^2026-/);
      }
    }
  });
});
