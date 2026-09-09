import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import type { LegalSource } from './domain.js';
import { LegalCatalog } from './catalog.js';

export type DownloadCandidate = Pick<LegalSource, 'id' | 'title' | 'url'> & { documentUrl?: string };
export type DownloadResult = { id: string; url: string; fileName: string; status: 'descargado' | 'inaccesible' | 'pendiente_verificacion'; checkedAt: string; httpStatus?: number; contentType?: string; bytes?: number; sha256?: string; error?: string };

const official = (url: string) => { const parsed = new URL(url); return parsed.protocol === 'https:' && (parsed.hostname === 'gob.ec' || parsed.hostname.endsWith('.gob.ec')); };
const safeName = (id: string, url: string) => `${id}${extname(new URL(url).pathname).toLowerCase() || '.html'}`;

export function extractDocumentLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(/(?:href|src)=["']([^"']+\.(?:pdf|docx?|odt)(?:[?#][^"']*)?)["']/gi)) {
    try {
      const url = new URL(match[1], baseUrl).toString();
      if (official(url)) links.add(url);
    } catch { /* enlace inválido: se omite */ }
  }
  return [...links];
}

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
  const manifestPath = resolve(root, 'data', 'download-manifest.json');
  const queue = [...buildDownloadPlan(catalog.all())];
  const queued = new Set(queue.map((item) => item.url));
  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index];
    const checkedAt = new Date().toISOString();
    try {
      const response = await fetch(item.url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'leyes-ecuador-dev-mcp-downloader/1.0' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') ?? undefined;
      const body = Buffer.from(await response.arrayBuffer());
      if (body.byteLength > 20 * 1024 * 1024) throw new Error('archivo supera el límite de 20 MiB');
      const sha256 = createHash('sha256').update(body).digest('hex');
      const fileName = item.fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
      await writeFile(resolve(directory, fileName), body);
      results.push({ id: item.id, url: item.url, fileName, status: 'descargado', checkedAt, httpStatus: response.status, contentType, bytes: body.byteLength, sha256 });
      if (contentType?.toLowerCase().includes('text/html')) {
        for (const [childIndex, url] of extractDocumentLinks(body.toString('utf8'), item.url).entries()) {
          if (!queued.has(url)) { queued.add(url); queue.push({ id: `${item.id}-document-${childIndex + 1}`, title: item.title, url, fileName: safeName(`${item.id}-document-${childIndex + 1}`, url) }); }
        }
      }
    } catch (error) {
      results.push({ id: item.id, url: item.url, fileName: item.fileName, status: 'inaccesible', checkedAt, error: error instanceof Error ? error.message : String(error) });
    }
    await writeFile(manifestPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`, 'utf8');
  }
  return { manifestPath, results };
}

if (process.argv[1]?.endsWith('download-sources.ts')) downloadCatalogSources().then(({ manifestPath, results }) => console.error(`Procesadas ${results.length} fuentes; manifiesto: ${manifestPath}`)).catch((error) => { console.error(error); process.exitCode = 1; });
