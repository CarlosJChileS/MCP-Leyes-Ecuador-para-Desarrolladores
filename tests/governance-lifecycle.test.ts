import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGovernanceLifecycle } from '../src/governance-lifecycle.js';

describe('governance lifecycle persistence', () => {
  it('stores audits, actions, evidence, exceptions and an audit trail', async () => {
    const root = await mkdtemp(join(tmpdir(), 'governance-lifecycle-'));
    const store = createGovernanceLifecycle(root);
    const audit = await store.recordAudit({ project: 'API', generatedAt: '2026-09-08T00:00:00.000Z', remediationPlan: [{ id: 'GOV-001', area: 'Código', problem: 'XSS', priority: 'alta', suggestedOwner: 'Seguridad', steps: ['Escapar salida'], expectedEvidence: ['Prueba'], completionCriteria: 'Escáner limpio' }] }, 'auditor');
    await store.updateAction('GOV-001', { status: 'en_progreso', dueDate: '2026-09-30', owner: 'Ana' }, 'Ana');
    await store.addEvidence('GOV-001', { description: 'Prueba de regresión', uri: 'tests/xss.test.ts' }, 'Ana');
    await store.addException('GOV-001', { reason: 'Migración en curso', approvedBy: 'CISO', expiresAt: '2026-09-20' }, 'CISO');
    const state = await store.load();
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0].id).toBe(audit.auditId);
    expect(state.actions[0]).toMatchObject({ id: 'GOV-001', status: 'aceptada_temporalmente', dueDate: '2026-09-30', owner: 'Ana' });
    expect(state.evidence[0]).toMatchObject({ actionId: 'GOV-001', uri: 'tests/xss.test.ts' });
    expect(state.exceptions[0]).toMatchObject({ actionId: 'GOV-001', approvedBy: 'CISO' });
    expect(state.history.length).toBe(4);
    expect(JSON.parse(await readFile(join(root, '.mcp-governance', 'lifecycle.json'), 'utf8')).schemaVersion).toBe(1);
  });
});
