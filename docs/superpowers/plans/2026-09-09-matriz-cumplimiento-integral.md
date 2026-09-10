# Matriz Integral de Cumplimiento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Exponer por el MCP una matriz detallada de obligaciones ecuatorianas aplicables a Demera, con estados, prioridades, riesgos, evidencias y criterios de cierre.

**Architecture:** Mantener `assessProject` como agregador compatible y añadir una función pura de clasificación de obligaciones. La salida conservará los campos existentes y añadirá `obligations`; el checklist convertirá cada obligación en una acción trazable.

**Tech Stack:** TypeScript, Zod/JSON catalog, Vitest, MCP stdio.

---

### Task 1: Modelar obligaciones accionables

**Files:**
- Modify: `src/compliance.ts`
- Test: `tests/compliance.test.ts`

- [ ] Add typed status/priority fields and derive them conservatively from source status and obligation metadata.
- [ ] Return norm, article, requirement, applicability reason, evidence, gap, risk, owner, due date, close criterion and source URL.
- [ ] Keep current `risks`, `controls`, `questions` and `references` fields unchanged.
- [ ] Add tests for a personal project using providers and verify LOPDP obligations are returned as pending legal review.

### Task 2: Exponer la matriz en el checklist

**Files:**
- Modify: `src/compliance.ts`
- Test: `tests/compliance.test.ts`

- [ ] Make each checklist item include its obligation id, status, priority, evidence and closure criterion.
- [ ] Preserve the existing final source-review item for backward compatibility.
- [ ] Test that missing evidence is represented as a pending action rather than compliance.

### Task 3: Validar contrato MCP y documentación

**Files:**
- Modify: `tests/stdio.test.ts`
- Modify: `README.md`

- [ ] Add a stdio integration assertion for the detailed obligation fields.
- [ ] Document the states, conservative interpretation and Demera example.
- [ ] Run `npm run check` and verify all tests pass.

### Task 4: Revisión final

- [ ] Build the package and run the real MCP client against `C:\Users\carlo\Videos\contableDemera`.
- [ ] Confirm the response includes applicable norms, obligations, evidence and reasons.
- [ ] Review the diff and commit the implementation.
