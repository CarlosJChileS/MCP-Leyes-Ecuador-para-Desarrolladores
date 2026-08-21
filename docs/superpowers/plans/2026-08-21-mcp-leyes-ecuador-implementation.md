# MCP de leyes de Ecuador para desarrolladores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un servidor MCP local en TypeScript que consulte un catálogo verificable de normativa ecuatoriana y genere orientación preliminar y checklists para desarrolladores.

**Architecture:** Un núcleo funcional independiente contendrá el catálogo normativo, validación y reglas de evaluación. Una capa MCP adaptará esas funciones a herramientas y recursos, manteniendo las respuestas trazables con fuente y fecha de verificación. La primera ejecución usará transporte `stdio`.

**Tech Stack:** Node.js, TypeScript, Vitest, Zod, SDK oficial `@modelcontextprotocol/server`.

---

### Task 1: Inicializar el proyecto y contrato de datos

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/domain.ts`
- Create: `tests/domain.test.ts`

- [ ] **Step 1: Escribir pruebas fallidas para validar una fuente normativa y rechazar registros incompletos.**
- [ ] **Step 2: Ejecutar `npm test -- tests/domain.test.ts` y confirmar que falla porque el módulo aún no existe.**
- [ ] **Step 3: Implementar tipos y `validateLegalSource` con validación estricta de URL HTTPS, estado y fecha.**
- [ ] **Step 4: Ejecutar la prueba y confirmar que pasa.**
- [ ] **Step 5: Registrar el commit `feat: initialize legal catalog domain`.**

### Task 2: Implementar catálogo y búsqueda

**Files:**
- Create: `data/normativa.json`
- Create: `src/catalog.ts`
- Create: `tests/catalog.test.ts`

- [ ] **Step 1: Escribir pruebas fallidas para buscar por texto/tema y exigir fuentes en resultados.**
- [ ] **Step 2: Ejecutar las pruebas y confirmar el fallo por ausencia del catálogo.**
- [ ] **Step 3: Añadir registros iniciales de LOPDP, Reglamento LOPDP, comercio electrónico y propiedad intelectual con URLs oficiales y fechas de verificación.**
- [ ] **Step 4: Implementar carga, validación, búsqueda y consulta por identificador.**
- [ ] **Step 5: Ejecutar todas las pruebas del catálogo y confirmar que pasan.**
- [ ] **Step 6: Registrar el commit `feat: add verified Ecuador legal catalog`.**

### Task 3: Implementar evaluación y checklist

**Files:**
- Create: `src/compliance.ts`
- Create: `tests/compliance.test.ts`

- [ ] **Step 1: Escribir pruebas fallidas para identificar tratamiento de datos, proveedores y evidencias faltantes.**
- [ ] **Step 2: Ejecutar las pruebas y confirmar el fallo por ausencia del motor.**
- [ ] **Step 3: Implementar reglas deterministas que devuelvan riesgos, controles, preguntas pendientes y referencias, sin afirmar certificación.**
- [ ] **Step 4: Implementar generación de checklist reproducible a partir del proyecto y del catálogo.**
- [ ] **Step 5: Ejecutar pruebas y confirmar que pasan.**
- [ ] **Step 6: Registrar el commit `feat: add preliminary compliance assessment`.**

### Task 4: Exponer capacidades por MCP

**Files:**
- Create: `src/server.ts`
- Create: `tests/server.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Escribir pruebas de contrato para las herramientas `buscar_normativa`, `consultar_obligacion`, `evaluar_proyecto`, `generar_checklist_auditoria` y `verificar_vigencia`.**
- [ ] **Step 2: Ejecutar las pruebas y confirmar el fallo por ausencia del servidor.**
- [ ] **Step 3: Registrar las herramientas y recursos usando el SDK oficial, validando entradas y devolviendo JSON estructurado con fuentes y aviso legal.**
- [ ] **Step 4: Añadir arranque `stdio` y scripts `build`, `start` y `dev`.**
- [ ] **Step 5: Ejecutar pruebas de contrato y confirmar que pasan.**
- [ ] **Step 6: Registrar el commit `feat: expose legal capabilities through MCP`.**

### Task 5: Documentar ejecución y verificaciones

**Files:**
- Create: `README.md`
- Create: `.gitignore`

- [ ] **Step 1: Documentar requisitos, instalación, ejecución local, configuración de un cliente MCP, alcance y límites jurídicos.**
- [ ] **Step 2: Ejecutar `npm run build` y `npm test -- --run`.**
- [ ] **Step 3: Corregir cualquier error de tipos, pruebas o documentación detectado.**
- [ ] **Step 4: Registrar el commit `docs: document local MCP usage`.**
