# MCP Leyes Ecuador para Desarrolladores

Servidor [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) en TypeScript para consultar normativa ecuatoriana y realizar revisiones técnicas preliminares de privacidad, seguridad y cumplimiento en repositorios de software.

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
- `auditar_repositorio`: escaneo estático local de solo lectura.

Recursos: `legal://normativa` y `legal://normativa/{id}`. Prompt: `revision-privacidad`.

## Idiomas

Las herramientas aceptan `language: "es"` (predeterminado) o `language: "en"`. Las respuestas de evaluación, checklist, mensajes y descargos se generan en el idioma seleccionado. Los títulos y textos de las normas conservan el idioma oficial publicado por la fuente.

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
  "dependencyScan": true
}
```

El resultado incluye resumen, lenguajes detectados, hallazgos por severidad, controles sugeridos, referencias y descargo de responsabilidad. Puede generar JSON, Markdown o HTML y ejecutar escáneres locales disponibles como `npm audit`, `pip-audit`, `cargo audit`, herramientas .NET y `osv-scanner`.

Medidas de seguridad: no ejecuta código del repositorio, excluye dependencias y builds, evita enlaces simbólicos fuera de la raíz, limita profundidad/tamaño/cantidad de archivos y redacta valores sensibles.

## Instalación y uso

Requiere Node.js 20 o superior.

```bash
npm install
npm test -- --run
npm run build
npm start
```

El servidor usa `stdio`. Configuración de ejemplo:

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

## Catálogo y verificación

```bash
npm run catalog:discover
npm run catalog:verify
npm run catalog:import
npm run catalog:review
```

Informes:

- `data/discovered-sources.json`: referencias pendientes de revisión.
- `data/verification-report.json`: accesibilidad y dominio oficial.
- `data/catalog-pending.json`: referencias oficiales importadas como pendientes de clasificación y revisión jurídica.
- `data/catalog-review.json`: clasificación preliminar y verificación documental de accesibilidad; no certifica vigencia.

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

Este trabajo requiere fuentes oficiales completas, reglas de consolidación y revisión jurídica. No se debe inferir vigencia únicamente desde una URL accesible.

La importación automática prepara referencias para revisión; no las mezcla con `data/normativa.json` hasta completar sus metadatos y confirmar su estado.

## Desarrollo

```bash
npm test -- --run
npm run build
npm run catalog:verify
```

La suite valida catálogo, búsquedas, obligaciones, auditoría, detección multilenguaje, reportes y límites de seguridad.

## Responsabilidad

Las normas enlazadas pertenecen a sus fuentes oficiales. Este proyecto no sustituye la revisión legal, técnica, contractual ni de seguridad necesaria para operar un sistema en producción.
