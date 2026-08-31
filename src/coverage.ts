import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { LegalCatalog } from './catalog.js';

export async function createCoverageReport(catalog?: LegalCatalog) {
  catalog ??= await LegalCatalog.load();
  const sources = catalog.all();
  const by = (field: (source: typeof sources[number]) => string) => Object.fromEntries([...new Set(sources.map(field))].map((value) => [value, sources.filter((source) => field(source) === value).length]));
  return { generatedAt: new Date().toISOString(), catalogSize: sources.length, status: by((source) => source.status), type: by((source) => source.type), topics: Object.fromEntries([...new Set(sources.flatMap((source) => source.topics))].sort().map((topic) => [topic, sources.filter((source) => source.topics.includes(topic)).length])), historicalRecords: sources.filter((source) => (source.history?.length ?? 0) > 0).length, legalReviews: sources.filter((source) => source.verification?.legalReviewedAt).length, limitations: ['No representa todavía el universo completo del Registro Oficial.', 'La vigencia requiere revisión jurídica documentada.', 'Las referencias pendientes no se mezclan con el catálogo curado.'] };
}

if (process.argv[1]?.endsWith('coverage.ts')) createCoverageReport().then(async (report) => { const output = resolve(process.cwd(), 'data/coverage-report.json'); await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8'); console.error(`Reporte de cobertura generado: ${output}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
