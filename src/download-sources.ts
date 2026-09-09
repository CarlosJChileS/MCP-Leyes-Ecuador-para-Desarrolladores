import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import type { LegalSource } from './domain.js';
import { LegalCatalog } from './catalog.js';

export type DownloadCandidate = Pick<LegalSource, 'id' | 'title' | 'url'> & { documentUrl?: string };
export type DownloadResult = { id: string; url: string; fileName: string; status: 'descargado' | 'inaccesible' | 'pendiente_verificacion'; checkedAt: string; httpStatus?: number; contentType?: string; bytes?: number; sha256?: string; error?: string };

const official = (url: string) => { const parsed = new URL(url); return parsed.protocol === 'https:' && (parsed.hostname === 'gob.ec' || parsed.hostname.endsWith('.gob.ec')); };
const safeName = (id: string, url: string) => `${id}${extname(new URL(url).pathname).toLowerCase() || '.html'}`;

export function buildDownloadPlan(sources: DownloadCandidate[]) {
  const seen = new Set<string>();
  return sources.flatMap((source) => {
    const url = source.documentUrl ?? source.url;
    if (!official(url) || seen.has(url)) return [];
    seen.add(url);
    return [{ id: source.id, title: source.title, url, fileName: safeName(source.id, url) }];
  });
}

export async function downloadCatalogSources(root = process.cwd()): Promise<{ manifestPath: string; results: DownloadResult[] }> {
  const catalog = await LegalCatalog.load();
  const directory = resolve(root, 'data', 'downloads');
  await mkdir(directory, { recursive: true });
  const results: DownloadResult[] = [];
  for (const item of buildDownloadPlan(catalog.all())) {
    const checkedAt = new Date().toISOString();
    try {
      const response = await fetch(item.url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'leyes-ecuador-dev-mcp-downloader/1.0' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = Buffer.from(await response.arrayBuffer());
      if (body.byteLength > 20 * 1024 * 1024) throw new Error('archivo supera el límite de 20 MiB');
      const sha256 = createHash('sha256').update(body).digest('hex');
      const fileName = item.fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
      await writeFile(resolve(directory, fileName), body);
      results.push({ id: item.id, url: item.url, fileName, status: 'descargado', checkedAt, httpStatus: response.status, contentType: response.headers.get('content-type') ?? undefined, bytes: body.byteLength, sha256 });
    } catch (error) {
      results.push({ id: item.id, url: item.url, fileName: item.fileName, status: 'inaccesible', checkedAt, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const manifestPath = resolve(root, 'data', 'download-manifest.json');
  await writeFile(manifestPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`, 'utf8');
  return { manifestPath, results };
}

if (process.argv[1]?.endsWith('download-sources.ts')) downloadCatalogSources().then(({ manifestPath, results }) => console.error(`Procesadas ${results.length} fuentes; manifiesto: ${manifestPath}`)).catch((error) => { console.error(error); process.exitCode = 1; });
