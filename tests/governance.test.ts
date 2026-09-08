import { describe, expect, it } from 'vitest';
import { evaluateDataGovernance } from '../src/governance.js';
import type { LegalSource } from '../src/domain.js';

const source = (id: string, topics: string[]): LegalSource => ({
  id,
  title: id,
  type: 'ley',
  issuer: 'Ecuador',
  jurisdiction: 'Ecuador',
  publishedAt: '2023-01-01',
  verifiedAt: '2026-01-01',
  status: 'pendiente_verificacion',
  url: `https://www.registroficial.gob.ec/${id}`,
  topics,
});

describe('data governance coverage', () => {
  it('maps every governance domain to catalog evidence or an explicit catalog gap', () => {
    const result = evaluateDataGovernance(
      { name: 'API ciudadana', dataTypes: ['datos personales'], owners: ['responsable'], retentionDays: 365 },
      [source('lopdp', ['datos personales', 'privacidad']), source('lotaip', ['transparencia', 'datos abiertos'])],
    );

    expect(result.coverage).toHaveLength(22);
    expect(result.coverage.find(item => item.domain === 'protección de datos personales')).toMatchObject({
      status: 'catalogado',
      sourceIds: ['lopdp'],
    });
    expect(result.coverage.find(item => item.domain === 'datos públicos y abiertos')).toMatchObject({
      status: 'catalogado',
      sourceIds: ['lotaip'],
    });
    expect(result.coverage.find(item => item.domain === 'salud')).toMatchObject({
      status: 'pendiente_catalogo',
      sourceIds: [],
    });
    expect(result.coverageSummary).toMatchObject({ totalDomains: 22, coveredDomains: 3, pendingDomains: 19 });
    expect(result.coverageSummary.pending).toContain('salud');
  });
});
