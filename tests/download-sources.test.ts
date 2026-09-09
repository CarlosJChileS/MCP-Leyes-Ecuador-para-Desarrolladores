import { describe, expect, it } from 'vitest';
import { buildDownloadPlan, classifyDownloadedContent, extractDocumentLinks } from '../src/download-sources.js';

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

  it('distinguishes legal HTML from portals and indexes', () => {
    expect(classifyDownloadedContent('text/html', '<title>Reglamento a la Ley de Comercio Electrónico</title><p>Artículo 1.- Objeto</p>')).toBe('norma_html');
    expect(classifyDownloadedContent('text/html', '<title>Ministerio de Salud Pública</title><p>Institución del Estado</p>')).toBe('portal_institucional');
    expect(classifyDownloadedContent('text/html', '<title>Leyes Aprobadas | Asamblea Nacional</title>')).toBe('indice_normativo');
    expect(classifyDownloadedContent('application/pdf', '')).toBe('documento_normativo');
  });
});
