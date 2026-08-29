# Detección Multilenguaje Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar la auditoría para identificar lenguajes y aplicar reglas específicas a los principales ecosistemas de desarrollo.

**Architecture:** Mantener el recorrido seguro existente y separar la detección de lenguaje de las reglas de auditoría. Cada archivo tendrá un lenguaje detectado y se aplicarán detectores compartidos más detectores por familia, sin ejecutar código ni depender de herramientas externas.

**Tech Stack:** TypeScript, Node.js, Vitest, MCP stdio existente.

---

### Task 1: Contrato de detección y reporte

**Files:**
- Modify: `tests/audit.test.ts`

- [ ] Añadir pruebas para detectar por extensión JavaScript/TypeScript, Python, JVM, .NET, Go, Rust, Ruby, C/C++, Swift, Dart, SQL, Shell, YAML/JSON/TOML, Docker y Terraform.
- [ ] Añadir pruebas para `languages` y conteos en el resumen, y para indicar el lenguaje en cada hallazgo.
- [ ] Ejecutar las pruebas y confirmar el fallo inicial.

### Task 2: Detector multilenguaje y reglas específicas

**Files:**
- Create: `src/languages.ts`
- Modify: `src/audit.ts`

- [ ] Crear un registro central de extensiones, nombres especiales y familias de lenguaje.
- [ ] Añadir detección determinista y clasificación `desconocido` para texto no reconocido.
- [ ] Integrar el lenguaje en cada archivo escaneado, resumen y hallazgo.
- [ ] Aplicar reglas específicas por familia para secretos, logs, URLs inseguras, cookies, CORS, endpoints y configuraciones peligrosas.
- [ ] Mantener límites, exclusiones, redacción y protección de enlaces existentes.
- [ ] Ejecutar las pruebas de auditoría y corregir fallos.

### Task 3: Integración MCP y documentación

**Files:**
- Modify: `README.md`
- Modify: `src/server.ts` (solo si cambia el esquema o descripción)

- [ ] Documentar lenguajes soportados, archivos especiales y comportamiento para lenguajes desconocidos.
- [ ] Mantener la interfaz de `auditar_repositorio` compatible.
- [ ] Ejecutar `npm test -- --run`, `npm run build` y una llamada MCP real.
- [ ] Revisar diferencias y crear commit de implementación.
