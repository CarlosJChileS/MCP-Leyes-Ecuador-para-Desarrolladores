import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LegalCatalog } from './catalog.js';

export type VerificationResult = { id: string; url: string; officialHost: boolean; reachable: boolean; httpStatus?: number; checkedAt: string; conclusion: 'requiere_revision_juridica' };

export async function verifyCatalog(catalog?: LegalCatalog): Promise<VerificationResult[]> {
  catalog ??= await LegalCatalog.load();
  const checkedAt = new Date().toISOString();
  return Promise.all(catalog.all().map(async (source) => {
    let reachable = false; let httpStatus: number | undefined;
    try {
      const headers = { 'user-agent': 'mcp-leyes-ecuador-verifier/0.1' };
      let response = await fetch(source.url, { method: 'HEAD', redirect: 'follow', headers });
      if (response.status === 405 || response.status === 501) {
        response = await fetch(source.url, { method: 'GET', redirect: 'follow', headers });
      }
      reachable = response.ok;
      httpStatus = response.status;
    } catch { /* se informa como no accesible */ }
    const host = new URL(source.url).hostname.toLowerCase();
    return { id: source.id, url: source.url, officialHost: host.endsWith('.gob.ec') || host === 'gob.ec', reachable, httpStatus, checkedAt, conclusion: 'requiere_revision_juridica' as const };
  }));
}

export async function writeVerificationReport(output = resolve(process.cwd(), 'data/verification-report.json')) {
  const results = await verifyCatalog();
  await writeFile(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`, 'utf8');
  return { output, results };
}

if (process.argv[1]?.endsWith('verify.ts')) writeVerificationReport().then(({ output, results }) => console.error(`Verificadas ${results.length} fuentes; ninguna se marca automáticamente como vigente: ${output}`)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
