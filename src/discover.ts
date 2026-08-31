import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type DiscoveredSource = { title: string; url: string; discoveredAt: string; origin: string; status: 'requiere_revision' };
const OFFICIAL_INDEXES = [
  { origin: 'Asamblea Nacional - leyes aprobadas', url: 'https://www.asambleanacional.gob.ec/es/leyes-aprobadas' },
  { origin: 'Registro Oficial - índice de legislación', url: 'https://www.registroficial.gob.ec/category/productos/indice/' },
];

const MAX_REGISTRY_PAGES = Number.parseInt(process.env.MCP_CATALOG_MAX_PAGES ?? '10', 10);
const REQUEST_TIMEOUT_MS = 15000;

export async function discoverOfficialSources(): Promise<DiscoveredSource[]> {
  const found = new Map<string, DiscoveredSource>();
  for (const source of OFFICIAL_INDEXES) {
    const urls = source.origin.startsWith('Registro Oficial')
      ? [source.url, ...Array.from({ length: Math.max(0, MAX_REGISTRY_PAGES - 1) }, (_, index) => `${source.url.replace(/\/$/, '')}/page/${index + 2}/`)]
      : [source.url];
    await Promise.all(urls.map(async (pageUrl) => {
    const response = await fetch(pageUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { 'user-agent': 'mcp-leyes-ecuador-source-discovery/0.1' } }).catch(() => undefined);
    if (!response?.ok) return;
    const html = await response.text();
    for (const match of html.matchAll(/<a\b[^>]*href=["'](https:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const url = match[1];
      const title = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!title || title.length < 4 || !url.startsWith('https://')) continue;
      // Los índices contienen navegación, noticias y páginas institucionales.
      // Solo pasan candidatos cuyo texto parece una disposición normativa.
      if (!/(ley|c[oó]digo|reglamento|resoluci[oó]n|decreto|acuerdo ministerial|ordenanza|normativa|registro oficial)/i.test(title)) continue;
      if (/contacto|chrome|facebook|twitter|youtube|instagram|inicio|misi[oó]n|visi[oó]n|qui[eé]nes|noticia|participa|votaciones|manual|pol[ií]tica|[íi]ndice|suplemento|edici[oó]n|sentencias/i.test(title)) continue;
      const key = `${title.toLowerCase()}|${url}`;
      found.set(key, { title, url, discoveredAt: new Date().toISOString().slice(0, 10), origin: source.origin, status: 'requiere_revision' });
    }
    }));
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
