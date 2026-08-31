import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DiscoveredSource } from './discover.js';

type Pending = { id: string; title: string; type: string; issuer: string; jurisdiction: 'Ecuador'; publishedAt: string; verifiedAt: string; status: 'pendiente_verificacion'; url: string; topics: string[]; summary?: string };
const input = resolve(process.cwd(), 'data/catalog-pending.json');
const output = resolve(process.cwd(), 'data/catalog-review.json');

function classify(title: string) {
  const value = title.toLowerCase();
  if (/reglamento/.test(value)) return 'reglamento';
  if (/resoluci[oó]n/.test(value)) return 'resolución';
  if (/c[oó]digo/.test(value)) return 'codigo';
  if (/ley/.test(value)) return 'ley';
  return 'referencia_oficial';
}

async function check(url: string) {
  try {
    const headers = { 'user-agent': 'mcp-leyes-ecuador-reviewer/0.1' };
    let response = await fetch(url, { method: 'HEAD', redirect: 'follow', headers });
    if (response.status === 405 || response.status === 501) response = await fetch(url, { redirect: 'follow', headers });
    return { reachable: response.ok, httpStatus: response.status, finalUrl: response.url };
  } catch (error) { return { reachable: false, error: error instanceof Error ? error.message : String(error) }; }
}

export async function reviewPendingCatalog() {
  const report = JSON.parse(await readFile(input, 'utf8')) as { sources: Pending[] };
  const reviewed = await Promise.all(report.sources.map(async (source) => ({
    ...source,
    type: classify(source.title),
    documentaryVerification: await check(source.url),
    legalReview: { status: 'requiere_revision_juridica', missing: ['fecha_publicación_confirmada', 'numero_registro_oficial', 'reformas', 'derogaciones', 'vigencia_consolidada'] },
  })));
  await writeFile(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), source: input, warning: 'La accesibilidad y clasificación no prueban vigencia jurídica.', sources: reviewed }, null, 2)}\n`, 'utf8');
  return { output, count: reviewed.length, reachable: reviewed.filter((source) => source.documentaryVerification.reachable).length };
}

if (process.argv[1]?.endsWith('review-catalog.ts')) reviewPendingCatalog().then(({ output, count, reachable }) => console.error(`Revisadas ${count} referencias; ${reachable} accesibles. Revisión jurídica pendiente: ${output}`)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
