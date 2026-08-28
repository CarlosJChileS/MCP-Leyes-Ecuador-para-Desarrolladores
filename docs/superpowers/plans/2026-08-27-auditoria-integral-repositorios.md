# Auditoría Integral de Repositorios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una herramienta MCP de auditoría estática, local y de solo lectura para repositorios.

**Architecture:** Separar el análisis en `src/audit.ts`, con recorrido seguro, reglas deterministas y reporte tipado. `src/server.ts` solo adaptará la entrada MCP y asociará las fuentes del catálogo. Las pruebas usarán directorios temporales y mantendrán el contrato existente.

**Tech Stack:** TypeScript, Node.js `fs/promises`, Vitest, MCP stdio existente.

---

### Task 1: Definir contrato y pruebas de auditoría

**Files:**
- Create: `tests/audit.test.ts`
- Modify: `tests/server.test.ts`

- [ ] **Step 1: Añadir pruebas que esperan un informe con resumen, hallazgos, controles y referencias, incluyendo detección y redacción de un secreto.**
- [ ] **Step 2: Añadir pruebas para exclusiones, ruta inválida y protección contra lectura fuera del directorio.**
- [ ] **Step 3: Añadir prueba de registro MCP para `auditar_repositorio`.**
- [ ] **Step 4: Ejecutar `npm test -- --run tests/audit.test.ts tests/server.test.ts` y confirmar el fallo inicial por módulo/herramienta inexistente.**

### Task 2: Implementar el motor estático seguro

**Files:**
- Create: `src/audit.ts`

- [ ] **Step 1: Definir `AuditFinding`, `AuditReport`, opciones y severidades.**
- [ ] **Step 2: Implementar resolución de ruta, recorrido recursivo con límites y exclusión de `node_modules`, `.git`, `dist`, `build`, `.next`, binarios y archivos grandes.**
- [ ] **Step 3: Implementar reglas deterministas para secretos, datos personales, logs sensibles, HTTP inseguro, CORS permisivo, cookies inseguras, endpoints sensibles y documentación de privacidad ausente.**
- [ ] **Step 4: Redactar valores sensibles en evidencia y calcular el resumen por severidad/categoría.**
- [ ] **Step 5: Ejecutar las pruebas de auditoría y corregir hasta que pasen.**

### Task 3: Exponer la auditoría mediante MCP

**Files:**
- Modify: `src/server.ts`
- Modify: `tests/server.test.ts`

- [ ] **Step 1: Registrar `auditar_repositorio` con ruta y opciones de límites.**
- [ ] **Step 2: Asociar los hallazgos con fuentes del catálogo por categorías y devolver el descargo legal.**
- [ ] **Step 3: Probar `tools/list` y una llamada `tools/call` real por stdio.**

### Task 4: Documentación y verificación final

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Documentar configuración, ejemplo de llamada, alcance y limitaciones.**
- [ ] **Step 2: Ejecutar `npm test -- --run` y `npm run build`.**
- [ ] **Step 3: Ejecutar handshake MCP y confirmar que la nueva herramienta aparece y responde.**
- [ ] **Step 4: Revisar `git diff` y crear un commit de implementación.**
