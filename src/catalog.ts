import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLegalSource, type LegalSource } from './domain.js';

export class LegalCatalog {
  constructor(private readonly sources: LegalSource[]) {}
  static async load(path = resolve(dirname(fileURLToPath(import.meta.url)), '../data/normativa.json')) {
    const raw = JSON.parse(await readFile(path, 'utf8')) as unknown[];
    if (!Array.isArray(raw)) throw new Error('El catálogo debe ser un arreglo');
    raw.forEach(validateLegalSource);
    const ids = new Set<string>();
    for (const source of raw as LegalSource[]) { if (ids.has(source.id)) throw new Error(`Identificador duplicado: ${source.id}`); ids.add(source.id); }
    return new LegalCatalog(raw as LegalSource[]);
  }
  search(query = '', topic?: string) { const q = query.trim().toLowerCase(); const t = topic?.trim().toLowerCase(); return this.sources.filter((s) => (!q || `${s.id} ${s.title} ${s.summary ?? ''} ${s.topics.join(' ')}`.toLowerCase().includes(q)) && (!t || s.topics.some((item) => item.toLowerCase() === t))); }
  get(id: string) { return this.sources.find((s) => s.id === id); }
  all() { return [...this.sources]; }
}
