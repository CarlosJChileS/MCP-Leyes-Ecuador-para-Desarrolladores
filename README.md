# MCP Leyes Ecuador para Desarrolladores

Servidor [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) en TypeScript para gobernanza de datos y leyes tecnológicas del Ecuador aplicadas a proyectos de software.

El producto es exclusivamente un servidor MCP local por `stdio`. Se utiliza desde un asistente o cliente compatible con MCP. Las herramientas, recursos y el prompt constituyen su interfaz; los reportes se devuelven como contenido de las respuestas MCP. Los scripts de catálogo y los workflows son utilidades internas de mantenimiento.

> **Aviso importante:** este proyecto es una herramienta de investigación y preauditoría. No constituye asesoría legal, dictamen, certificación ni garantía de cumplimiento. La vigencia y aplicación de cada norma debe confirmarse en la fuente oficial y con un profesional competente.

## Qué resuelve

Conecta un asistente compatible con MCP con un catálogo jurídico ecuatoriano y un auditor estático local. Permite buscar normas, consultar obligaciones, revisar señales técnicas de riesgo y generar un checklist inicial para proyectos tecnológicos y de comercio electrónico.

## Cobertura actual

El catálogo contiene un núcleo relevante de normativa nacional sobre protección de datos, comercio electrónico, firmas y mensajes de datos, propiedad intelectual, telecomunicaciones, transformación digital, fintech, defensa del consumidor, delitos informáticos, facturación electrónica, transparencia y resoluciones recientes de protección de datos.

1. **Cobertura de todas las leyes del Ecuador: todavía no.** No es aún una recopilación exhaustiva de toda la legislación nacional, códigos, reglamentos, ordenanzas, resoluciones sectoriales, normas municipales ni reformas históricas.
2. **Verificación jurídica completa de vigencia: no automática.** La herramienta comprueba accesibilidad y dominio oficial; no determina por sí sola derogaciones, reformas, suspensión, texto consolidado, ámbito de aplicación ni vigencia jurídica.

Las fuentes de descubrimiento son los índices oficiales de la [Asamblea Nacional](https://www.asambleanacional.gob.ec/es/leyes-aprobadas) y el [Registro Oficial](https://www.registroficial.gob.ec/category/productos/indice/). Una referencia descubierta nunca se incorpora automáticamente como norma vigente.

## Herramientas MCP

- `buscar_normativa`: búsqueda local por título, resumen, etiquetas y ámbito.
- `consultar_obligacion`: consulta obligaciones asociadas a una norma.
- `verificar_vigencia`: muestra estado, fechas, fuente y advertencias.
- `evaluar_proyecto`: relaciona el tipo de proyecto con riesgos preliminares.
- `generar_checklist_auditoria`: genera controles sugeridos.
- `evaluar_gobernanza_datos`: revisa 22 dominios y sus brechas de cobertura.
- `generar_inventario_datos`: prepara el inventario inicial de datos y evidencias faltantes.
- `evaluar_transferencia_datos`: identifica controles para transferencias nacionales e internacionales.
- `evaluar_evaluacion_impacto`: preclasifica riesgos y estructura la evaluación de impacto.
- `generar_matriz_responsabilidades`: propone funciones y asignaciones pendientes.
- `generar_informe_gobernanza`: reúne las cinco herramientas anteriores en JSON, Markdown, HTML o PDF.
- `gestionar_ciclo_gobernanza`: guarda auditorías, acciones, evidencias, excepciones, responsables, fechas e historial.
- `auditar_repositorio`: escaneo estático local de solo lectura.

Recursos: `legal://normativa` y `legal://normativa/{id}`. Prompts: `revision-privacidad` y `revision-gobernanza-datos`.

## Idiomas

Las trece herramientas aceptan `language: "es"` (predeterminado) o `language: "en"` cuando aplica. Las evaluaciones, checklists y descargos se generan en el idioma seleccionado. En la auditoría se traducen el resumen, los encabezados de reportes, las explicaciones y recomendaciones de las reglas y los títulos y descripciones de los controles.

## Informe consolidado de gobernanza

`generar_informe_gobernanza` ejecuta y consolida evaluación de gobernanza, inventario, transferencias, impacto y responsabilidades. Incluye resumen ejecutivo, cobertura de los 22 dominios, brechas, evidencias, fuentes y descargo jurídico.

Cada problema detectado produce una acción `GOV-###` que explica:

- qué está mal o incompleto y por qué importa;
- prioridad crítica, alta, media o baja;
- responsable sugerido;
- pasos concretos y ordenados para solucionarlo;
- documentos, registros o pruebas que deben conservarse;
- criterio verificable para considerar cerrada la acción.

El plan cubre fuentes normativas pendientes, clasificación e inventario, calidad, accesos, retención, transferencias, evaluaciones de impacto y roles sin asignar. Las recomendaciones técnicas pueden automatizarse; la vigencia, aplicabilidad y suficiencia jurídica deben ser aprobadas por una persona competente.

Si se proporciona `repositoryPath`, la misma llamada ejecuta la auditoría, incorpora archivos y directorios recorridos, entradas omitidas y hallazgos con archivo y línea. Con `dependencyScan: true` también agrega vulnerabilidades, versiones detectadas y corregidas, escáneres ausentes y soluciones. Cada hallazgo técnico se convierte en una acción `GOV-###` con recomendación, pruebas esperadas y criterio de cierre.

“Repositorio completo” significa todos los archivos reconocidos y legibles dentro de `maxDepth`, `maxFiles` y `maxFileSizeBytes`, respetando exclusiones y enlaces seguros. El informe declara sus conteos y omisiones; no afirma revisar archivos fuera de esos límites, binarios, servicios externos, bases de datos activas ni secretos ausentes de los archivos examinados.

```json
{
  "name": "API ciudadana",
  "dataTypes": ["cédula", "correo"],
  "systems": ["API", "PostgreSQL"],
  "owners": ["responsable del tratamiento"],
  "internationalTransfers": true,
  "retentionDays": 365,
  "repositoryPath": "C:/repos/api-ciudadana",
  "maxDepth": 12,
  "maxFiles": 2000,
  "maxFileSizeBytes": 1048576,
  "dependencyScan": true,
  "timeout": 120000,
  "format": "markdown"
}
```

`format` admite `json`, `markdown`, `html` y `pdf`. HTML incluye estilos A4 para imprimir. Con `persist: true` y `lifecycleActor`, el informe se guarda en `.mcp-governance/audits/` y actualiza `.mcp-governance/lifecycle.json`. Como MCP por `stdio` transporta texto, PDF devuelve un objeto con `fileName`, `mimeType`, `encoding: "base64"` y `data`; el cliente debe decodificar `data` para guardar el archivo indicado. El informe es una evaluación preliminar y no una certificación legal.

`gestionar_ciclo_gobernanza` permite `listar`, `actualizar_accion`, `agregar_evidencia` y `agregar_excepcion`. Conserva acciones abiertas y cerradas, responsables, fechas límite, evidencias, excepciones con expiración y un historial de actor, fecha y operación. Una excepción cambia la acción a `aceptada_temporalmente`.

Los títulos y textos normativos conservan el idioma de la fuente. Los identificadores, categorías y estados son valores estables del contrato y no se traducen; por ejemplo, `transporte_inseguro` y `pendiente`. Las evidencias, rutas, avisos de dependencias y detalles de errores conservan su contenido original. Los recursos jurídicos y el prompt `revision-privacidad` están en español.

## Auditoría de repositorios

`auditar_repositorio` inspecciona archivos de texto sin ejecutar el código. Detecta señales sobre secretos, datos personales, logging, autenticación, seguridad, infraestructura y documentación de privacidad.

Reconoce JavaScript, TypeScript, Vue, Python, Java, Kotlin, Scala, Groovy, Gradle, C#, F#, VB.NET, Go, Rust, Ruby, C, C++, Swift, Dart, SQL, Shell, PHP, YAML, JSON, JSONC, TOML, `.env`, INI, Docker, Terraform, XML, HTML, CSS, Markdown y texto plano. También reconoce `Dockerfile`, `Containerfile`, `Gemfile`, `Rakefile`, `README`, `LICENSE` y `.env*`.

Ejemplo:

```json
{
  "path": "C:/repos/mi-proyecto",
  "maxDepth": 6,
  "maxFiles": 500,
  "maxFileSizeBytes": 262144,
  "format": "json",
  "language": "es",
  "dependencyScan": true
}
```

El resultado incluye resumen, lenguajes detectados, hallazgos por severidad, controles sugeridos, referencias y descargo de responsabilidad. Puede generar JSON, Markdown o HTML y ejecutar escáneres locales disponibles como `npm audit`, `pip-audit`, `cargo audit`, herramientas .NET y `osv-scanner`.

El análisis estático no ejecuta código del repositorio: excluye dependencias y builds, evita enlaces simbólicos fuera de la raíz, limita profundidad/tamaño/cantidad de archivos y redacta valores sensibles. El escaneo de dependencias es opcional y ejecuta herramientas externas; estas pueden consultar servicios de vulnerabilidades y utilizar cachés locales.

### Parámetros de `auditar_repositorio`

| Parámetro | Valor por defecto | Uso |
| --- | --- | --- |
| `path` | Obligatorio | Ruta del repositorio; se recomienda absoluta. |
| `maxDepth` | 6 | Profundidad del análisis estático, entre 1 y 12. |
| `maxFiles` | 500 | Máximo de archivos del análisis estático, entre 1 y 2000. |
| `maxFileSizeBytes` | 262144 | Tamaño máximo por archivo, entre 1024 y 1048576 bytes. |
| `format` | `json` | `json`, `markdown`, `html` o `sarif`; SARIF permite integrarlo con GitHub Code Scanning. |
| `language` | `es` | `es` o `en`. |
| `dependencyScan` | `false` | Activa los escáneres de dependencias instalados. |
| `timeout` | 30000 | Tiempo máximo por comando externo, entre 1000 y 120000 ms. |

El servidor no guarda reportes automáticamente. El cliente puede guardar el contenido que recibe; el HTML incluye estilos de impresión. Un error de auditoría devuelve `isError: true` y un objeto con `error`, `detail`, `language` y `disclaimer`.

### Configuración del repositorio auditado

Coloque un archivo `.mcp-audit.json` en la raíz del repositorio que desea auditar:

```json
{
  "limits": { "maxDepth": 6, "maxFiles": 500, "maxFileSizeBytes": 262144 },
  "excludePaths": ["fixtures", "generated"],
  "statuses": {
    "findings": {
      "byId": {},
      "byRuleId": { "missing-privacy-docs": "pendiente" },
      "byCategory": {}
    },
    "controls": {
      "byId": { "control-revision-fuentes": "pendiente" },
      "byCategory": {}
    }
  }
}
```

Los parámetros de límites de la llamada tienen prioridad sobre el archivo. `excludePaths` acepta rutas relativas o prefijos de directorio, no patrones glob. El filtro se aplica después del recorrido: los archivos excluidos pueden consumir el límite de archivos. Esta configuración corresponde al análisis estático, no al escaneo externo de dependencias.

Estados permitidos: `cumple`, `no cumple`, `no aplica`, `pendiente`. Para hallazgos, la prioridad es identificador, regla y categoría; para controles, identificador y categoría. El valor predeterminado es `pendiente`. El servidor lee estos estados; su actualización y persistencia requieren editar el archivo. Un estado asignado no modifica la severidad ni demuestra cumplimiento por sí mismo.

### Escáneres opcionales

Deben estar disponibles en el `PATH` del proceso que inicia el cliente MCP:

| Ecosistema | Herramienta invocada | Preparación |
| --- | --- | --- |
| Node.js | `npm audit --json` | npm y un lockfile compatible en el proyecto. |
| Python | `pip-audit --format json` | Instalar `pip-audit`; los archivos requirements se pasan con `--requirement`. |
| Rust | `cargo audit --json` | Instalar Cargo y el subcomando `cargo-audit`; disponer de `Cargo.lock`. |
| .NET | `dotnet list … package --vulnerable --include-transitive --format json` | SDK compatible y proyecto con dependencias restauradas. |
| Varios | `osv-scanner --format json --recursive …` | Versión de OSV Scanner compatible con esos argumentos. |

Una herramienta ausente o fallida queda reflejada en el reporte; no equivale a ausencia de vulnerabilidades. Las pruebas usan adaptadores simulados para estos comandos y no acreditan que estén instalados en su equipo. La conexión MCP y el análisis estático se prueban con un proceso real.

Para una coincidencia intencional, agregue `mcp-audit-ignore` en esa línea y explique el motivo. La excepción queda visible en el código y no debe usarse para ocultar vulnerabilidades reales.

## Instalación y uso

Requiere Node.js 20 o superior.

```bash
npm ci
npm run check
```

También funciona con pnpm y Bun:

```bash
pnpm install --frozen-lockfile
pnpm run check

bun install
bun run check
```

Para desarrollo, `npm run dev`, `pnpm run dev` y `bun run dev` son equivalentes. El servidor se ejecuta por `stdio`; no se abre un puerto HTTP.

`npm run check` compila el servidor y ejecuta todas las pruebas, incluida la conexión real por `stdio`. Configure su cliente MCP para lanzar directamente el archivo compilado con Node:

```json
{
  "mcpServers": {
    "leyes-ecuador": {
      "command": "node",
      "args": ["C:/ruta/al/proyecto/dist/server.js"]
    }
  }
}
```

El catálogo está en `data/normativa.json` y se resuelve relativo al servidor compilado.

Reemplace la ruta de ejemplo por la ruta absoluta de su copia. Conserve `dist/` y `data/` dentro de la carpeta del proyecto; el cliente puede iniciar el proceso desde otro directorio. Si el cliente no encuentra `node`, use la ruta absoluta del ejecutable en `command`. Reinicie o reconecte el cliente después de recompilar.

Al conectarse deben aparecer trece herramientas, el recurso `legal://normativa`, la plantilla `legal://normativa/{id}` y los dos prompts. Puede pedir al asistente: «Genera el informe consolidado de gobernanza de API ciudadana en PDF» o «Audita el repositorio C:/repos/mi-proyecto en español, sin escanear dependencias».

Para diagnosticar el arranque, ejecute `node dist/server.js`. Es normal que espere sin mostrar texto: recibe mensajes MCP por la entrada estándar y reserva la salida estándar para el protocolo. Los errores de inicio se escriben en la salida de errores. `npm run dev` permite trabajar con el código TypeScript; vuelva a compilar antes de usar la configuración de producción del cliente.

## Catálogo y verificación

```bash
npm run catalog:discover
npm run catalog:verify
npm run catalog:import
npm run catalog:review
npm run catalog:coverage
npm run catalog:legal-review
```

`catalog:legal-review` genera `data/legal-review-report.json`, consulta las fuentes registradas y detecta indicios textuales de reformas o derogaciones. Estos indicios nunca cambian automáticamente una norma a vigente, reformada o derogada. Para publicar un estado confirmado, la entrada debe incluir `verification.legalReviewedAt` y `verification.reviewer`; el servidor rechaza el catálogo si faltan.

Informes:

- `data/discovered-sources.json`: referencias pendientes de revisión.
- `data/verification-report.json`: accesibilidad y dominio oficial.
- `data/catalog-pending.json`: referencias oficiales importadas como pendientes de clasificación y revisión jurídica.
- `data/catalog-review.json`: clasificación preliminar y verificación documental de accesibilidad; no certifica vigencia.
- `data/coverage-report.json`: tamaño, estados, tipos, temas, historial y revisiones jurídicas documentadas.

`.github/workflows/catalog-monitor.yml` ejecuta semanalmente pruebas, compilación, descubrimiento y verificación. Si encuentra cambios, abre un Pull Request para revisión humana.

## Roadmap jurídico

Se debe incorporar un catálogo histórico y actualizado del Registro Oficial, con:

- control de reformas y texto consolidado;
- registro de derogaciones, sustituciones y vigencia temporal;
- relación entre ley, código, reglamento y resolución;
- clasificación por sector: tecnología, comercio electrónico, financiero, laboral, tributario, consumo, salud, educación y otros;
- trazabilidad a número, suplemento, fecha y página del Registro Oficial;
- estados separados para accesibilidad técnica, revisión documental y vigencia jurídica;
- revisión humana antes de publicar cambios normativos.

El modelo de datos ya admite `officialGazette`, `history`, `relatedSourceIds` y `verification`, para conservar número/edición/página del Registro Oficial, reformas, derogaciones, relaciones y trazabilidad de los revisores.

Este trabajo requiere fuentes oficiales completas, reglas de consolidación y revisión jurídica. No se debe inferir vigencia únicamente desde una URL accesible.

La importación automática prepara referencias para revisión; no las mezcla con `data/normativa.json` hasta completar sus metadatos y confirmar su estado.

## Desarrollo

```bash
npm test -- --run
npm run build
npm run catalog:verify
```

La suite valida catálogo, búsquedas, obligaciones, gobernanza, auditoría, detección multilenguaje, reportes y límites de seguridad. La prueba de integración inicia el servidor compilado desde un directorio temporal, negocia el protocolo MCP, valida las trece herramientas, lee el índice y una ficha jurídica, obtiene los prompts y comprueba formatos y errores.

## Responsabilidad

Las normas enlazadas pertenecen a sus fuentes oficiales. Este proyecto no sustituye la revisión legal, técnica, contractual ni de seguridad necesaria para operar un sistema en producción.
