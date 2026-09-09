import { describe, expect, it } from 'vitest';
import { buildDownloadPlan, extractDocumentLinks } from '../src/download-sources.js';

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

  it('extracts official document links from downloaded portal HTML', () => {
    const html = '<a href="/docs/ley.pdf">Ley</a><a href="https://www.sri.gob.ec/docs/factura.doc">Factura</a><a href="https://www.sri.gob.ec/documentacion.html">Portal</a><a href="https://example.com/no.pdf">No oficial</a>';
    expect(extractDocumentLinks(html, 'https://www.asambleanacional.gob.ec/indice')).toEqual([
      'https://www.asambleanacional.gob.ec/docs/ley.pdf',
      'https://www.sri.gob.ec/docs/factura.doc',
    ]);
  });
});
