import { describe, expect, it } from 'vitest';
import { buildDownloadPlan } from '../src/download-sources.js';

describe('source downloader', () => {
  it('prefers document URLs, deduplicates sources and creates safe filenames', () => {
    const plan = buildDownloadPlan([
      { id: 'constitucion-republica', title: 'Constitución de la República', url: 'https://www.asambleanacional.gob.ec/indice', documentUrl: 'https://www.asambleanacional.gob.ec/docs/Constitución 2008.pdf' },
      { id: 'otra-fuente', title: 'Otra fuente', url: 'https://www.asambleanacional.gob.ec/indice', documentUrl: 'https://www.asambleanacional.gob.ec/docs/Constitución 2008.pdf' },
    ]);
    expect(plan).toHaveLength(1);
    expect(plan[0].url).toContain('.pdf');
    expect(plan[0].fileName).toBe('constitucion-republica.pdf');
  });
});
