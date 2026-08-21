import { describe, expect, it } from 'vitest';
import { validateLegalSource } from '../src/domain.js';

describe('validateLegalSource', () => {
  it('accepts a complete official source', () => {
    expect(validateLegalSource({ id: 'lopdp', title: 'LOPDP', type: 'ley', issuer: 'Asamblea Nacional', jurisdiction: 'Ecuador', publishedAt: '2021-05-26', verifiedAt: '2026-08-21', status: 'vigente', url: 'https://www.asambleanacional.gob.ec/', topics: ['datos personales'] })).toBe(true);
  });
  it('rejects an incomplete or insecure source', () => {
    expect(() => validateLegalSource({ id: 'x', title: 'x', type: 'ley', issuer: 'x', jurisdiction: 'Ecuador', publishedAt: '2021-01-01', verifiedAt: '2026-08-21', status: 'vigente', url: 'http://example.com', topics: [] })).toThrow();
  });
});
