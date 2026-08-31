import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DiscoveredSource } from './discover.js';
import { validateLegalSource, type LegalSource } from './domain.js';

const input = resolve(process.cwd(), 'data/discovered-sources.json');
const output = resolve(process.cwd(), 'data/catalog-pending.json');

function slug(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'fuente';
}

function importPending(sources: DiscoveredSource[], date = new Date().toISOString().slice(0, 10)): LegalSource[] {
  const used = new Set<string>();
  return sources.filter((source) => new URL(source.url).hostname.endsWith('.gob.ec') || new URL(source.url).hostname === 'gob.ec')
    .filter((source) => !/contacto|chrome|facebook|twitter|youtube|instagram|entradas más antiguas|proyectos de ley/i.test(source.title))
    .map((source) => {
      const base = `pendiente-${slug(source.title)}`;
      let id = base; let index = 2;
      while (used.has(id)) id = `${base}-${index++}`;
      used.add(id);
      return { id, title: source.title, type: 'referencia_oficial', issuer: source.origin, jurisdiction: 'Ecuador', publishedAt: date, verifiedAt: date, status: 'pendiente_verificacion', url: source.url, topics: ['pendiente de clasificación'], summary: 'Referencia descubierta en un índice oficial; requiere identificar tipo, fecha, número de Registro Oficial, reformas y vigencia.' };
    });
}

export async function writePendingCatalog() {
  const report = JSON.parse(await readFile(input, 'utf8')) as { sources: DiscoveredSource[] };
  const sources = importPending(report.sources);
  sources.forEach(validateLegalSource);
  await writeFile(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), source: input, warning: 'No son normas vigentes; requieren revisión documental y jurídica.', sources }, null, 2)}\n`, 'utf8');
  return { output, count: sources.length };
}

if (process.argv[1]?.endsWith('import-catalog.ts')) writePendingCatalog().then(({ output, count }) => console.error(`Importadas ${count} referencias pendientes: ${output}`)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
