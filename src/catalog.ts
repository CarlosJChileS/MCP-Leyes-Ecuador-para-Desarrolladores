import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateLegalSource, type LegalSource } from './domain.js';

export class LegalCatalog {
  constructor(private readonly sources: LegalSource[]) {}
  static async load(path = resolve(process.cwd(), 'data/normativa.json')) {
    const raw = JSON.parse(await readFile(path, 'utf8')) as unknown[];
    raw.forEach(validateLegalSource);
    return new LegalCatalog(raw as LegalSource[]);
  }
  search(query: string, topic?: string) { const q = query.toLowerCase(); return this.sources.filter((s) => (!query || `${s.title} ${s.summary ?? ''} ${s.topics.join(' ')}`.toLowerCase().includes(q)) && (!topic || s.topics.includes(topic.toLowerCase()))); }
  get(id: string) { return this.sources.find((s) => s.id === id); }
  all() { return [...this.sources]; }
}
