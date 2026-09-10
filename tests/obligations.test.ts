import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { LegalCatalog } from '../src/catalog.js';
import { consultObligations, legalVerification } from '../src/obligations.js';
import { validateLegalSource } from '../src/domain.js';
import { VERSION } from '../src/version.js';

it('requires evidence and distinguishes documented obligations from unknown coverage', async () => {
  const catalog = await LegalCatalog.load();
  const result = consultObligations(catalog.get('lopdp')!, 'en');
  expect(result.obligations.some(item => item.article === 'Art. 39')).toBe(true);
  expect(result.obligations.every(item => item.sourceUrl.startsWith('https:') && item.evidence.length > 0)).toBe(true);
  expect(result.coverage).toBe('parcial');
  expect(consultObligations(catalog.get('facturacion-electronica-sri')!, 'es').coverage).toBe('parcial');
  for (const source of catalog.all()) {
    const verified = legalVerification(source, 'es');
    if (!verified.legalStatusConfirmed) expect(source.status).toBe('pendiente_verificacion');
  }
});

it('rejects unsafe URLs and invalid nested legal metadata', async () => {
  const source = (await LegalCatalog.load()).get('lopdp')!;
  expect(() => validateLegalSource({ ...source, history: [{ type: 'reforma', title: 'test', sourceUrl: 'javascript:alert(1)' }] })).toThrow();
  expect(() => validateLegalSource({ ...source, verification: { documentaryReviewedAt: '2026-02-30' } })).toThrow();
  expect(() => validateLegalSource({ ...source, url: 'https://user:password@example.com' })).toThrow();
});

it('keeps package and server release versions aligned', () => {
  expect(JSON.parse(readFileSync('package.json', 'utf8')).version).toBe(VERSION);
});
