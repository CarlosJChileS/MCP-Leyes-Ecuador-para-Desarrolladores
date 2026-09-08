import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { LegalSource } from './domain.js';

type Evidence = { url: string; reachable: boolean; status?: number; finalUrl?: string; officialHost: boolean; error?: string };
type LegalReview = {
  id: string; title: string; currentStatus: LegalSource['status']; recommendedStatus: LegalSource['status'];
  evidence: Evidence[]; indicators: string[]; missing: string[]; conclusion: 'requiere_revision_juridica' | 'apta_para_revision_humana';
};

const official = (url: string) => { const host = new URL(url).hostname.toLowerCase(); return host === 'gob.ec' || host.endsWith('.gob.ec'); };
const today = () => new Date().toISOString().slice(0, 10);

async function inspect(url: string): Promise<Evidence> {
  try {
    const headers = { 'user-agent': 'mcp-leyes-ecuador-legal-review/1.0' };
    let response = await fetch(url, { method: 'HEAD', redirect: 'follow', headers, signal: AbortSignal.timeout(15000) });
    if (response.status === 405 || response.status === 501) response = await fetch(url, { redirect: 'follow', headers, signal: AbortSignal.timeout(15000) });
    await response.body?.cancel();
    return { url, reachable: response.ok, status: response.status, finalUrl: response.url, officialHost: official(response.url) };
  } catch (error) { return { url, reachable: false, officialHost: official(url), error: error instanceof Error ? error.message : String(error) }; }
}

async function indicators(urls: string[]) {
  const found: string[] = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'mcp-leyes-ecuador-legal-review/1.0' }, signal: AbortSignal.timeout(20000) });
      const body = (await response.text()).slice(0, 2_000_000).toLowerCase();
      if (/reform(a|ado|as|ó)|modific(a|ación)|sustituy/.test(body)) found.push(`indicio_reforma:${url}`);
      if (/derog(a|ación)|abrogad|queda sin efecto/.test(body)) found.push(`indicio_derogacion:${url}`);
    } catch { /* inspect() reports URL failure */ }
  }
  return found;
}

export async function generateLegalReview(input = resolve(process.cwd(), 'data/normativa.json'), output = resolve(process.cwd(), 'data/legal-review-report.json')) {
  const sources = JSON.parse(await readFile(input, 'utf8')) as LegalSource[];
  const reports: LegalReview[] = await Promise.all(sources.map(async source => {
    const urls = [...new Set([source.url, source.documentUrl, ...(source.history ?? []).map(item => item.sourceUrl)].filter(Boolean) as string[])];
    const evidence = await Promise.all(urls.map(inspect));
    const found = await indicators(urls.filter((_, index) => evidence[index]?.reachable));
    const missing = ['legalReviewedAt', 'reviewer', 'reformas_y_derogaciones_exhaustivas', 'texto_consolidado', 'ambito_de_aplicacion'];
    const humanReviewed = Boolean(source.verification?.legalReviewedAt && source.verification.reviewer);
    return { id: source.id, title: source.title, currentStatus: source.status, recommendedStatus: humanReviewed ? source.status : 'pendiente_verificacion', evidence, indicators: found, missing: humanReviewed ? missing.slice(2) : missing, conclusion: humanReviewed ? 'apta_para_revision_humana' : 'requiere_revision_juridica' };
  }));
  await writeFile(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), checkedAt: today(), warning: 'Los indicios automáticos no determinan vigencia jurídica. Requieren revisión humana.', sources: reports }, null, 2)}\n`, 'utf8');
  return { output, count: reports.length, reachable: reports.filter(report => report.evidence.some(item => item.reachable)).length };
}

if (process.argv[1]?.endsWith('legal-review.ts')) generateLegalReview().then(result => console.error(`Informe jurídico generado: ${result.output} (${result.count} normas; ${result.reachable} con fuentes accesibles)`)).catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
