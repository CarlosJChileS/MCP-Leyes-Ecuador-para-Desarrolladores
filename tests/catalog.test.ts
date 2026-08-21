import { describe, expect, it } from 'vitest';
import { LegalCatalog } from '../src/catalog.js';
describe('LegalCatalog', () => { it('loads and searches verified sources', async () => { const c = await LegalCatalog.load(); const results = c.search('datos personales'); expect(results.length).toBeGreaterThan(0); expect(results[0].url.startsWith('https://')).toBe(true); }); });
