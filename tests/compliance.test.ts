import { describe, expect, it } from 'vitest';
import { LegalCatalog } from '../src/catalog.js';
import { assessProject } from '../src/compliance.js';
describe('assessProject', () => { it('returns risks, controls and disclaimer for a data project', async () => { const c = await LegalCatalog.load(); const result = assessProject({ name: 'Portal escolar', processesPersonalData: true, usesProviders: true }, c.all()); expect(result.risks.length).toBeGreaterThan(0); expect(result.controls.length).toBeGreaterThan(0); expect(result.disclaimer).toContain('no constituye'); }); });
