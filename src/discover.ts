import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type DiscoveredSource = { title: string; url: string; discoveredAt: string; origin: string; status: 'requiere_revision' };
const OFFICIAL_INDEXES = [
  { origin: 'Asamblea Nacional - leyes aprobadas', url: 'https://www.asambleanacional.gob.ec/es/leyes-aprobadas' },
  { origin: 'Registro Oficial - índice de legislación', url: 'https://www.registroficial.gob.ec/category/productos/indice/' },
];

export async function discoverOfficialSources(): Promise<DiscoveredSource[]> {
  const found = new Map<string, DiscoveredSource>();
  for (const source of OFFICIAL_INDEXES) {
    const response = await fetch(source.url, { headers: { 'user-agent': 'mcp-leyes-ecuador-source-discovery/0.1' } });
    if (!response.ok) throw new Error(`No se pudo consultar ${source.url}: HTTP ${response.status}`);
    const html = await response.text();
    for (const match of html.matchAll(/<a\b[^>]*href=["'](https:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const url = match[1];
      const title = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!title || title.length < 4 || !url.startsWith('https://')) continue;
      const key = `${title.toLowerCase()}|${url}`;
      found.set(key, { title, url, discoveredAt: new Date().toISOString().slice(0, 10), origin: source.origin, status: 'requiere_revision' });
    }
  }
  return [...found.values()].sort((a, b) => a.title.localeCompare(b.title, 'es'));
}

export async function writeDiscoveryReport(output = resolve(process.cwd(), 'data/discovered-sources.json')) {
  const sources = await discoverOfficialSources();
  await writeFile(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), sources }, null, 2)}\n`, 'utf8');
  return { output, count: sources.length };
}

if (process.argv[1]?.endsWith('discover.ts')) {
  writeDiscoveryReport().then(({ output, count }) => console.error(`Descubiertas ${count} referencias; revisar antes de incorporarlas: ${output}`)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
