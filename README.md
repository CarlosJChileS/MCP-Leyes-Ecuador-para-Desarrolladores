# MCP Leyes Ecuador para Desarrolladores

Servidor MCP local en TypeScript para consultar normativa ecuatoriana y preparar revisiones preliminares de privacidad y cumplimiento.

## Ejecutar

Requiere Node.js 20 o superior.

```bash
npm install
npm test -- --run
npm run build
npm start
```

El servidor usa `stdio`, por lo que puede registrarse como servidor local en un cliente MCP. El catálogo inicial está en `data/normativa.json`.

Ejemplo de configuración para un cliente MCP:

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

El catálogo se resuelve relativo al servidor compilado, por lo que no depende del directorio desde el que el cliente lo inicie.

Para descubrir nuevas referencias desde índices oficiales:

```bash
npm run catalog:discover
```

El comando genera `data/discovered-sources.json` como bandeja de revisión. No incorpora automáticamente esas referencias al catálogo ni las marca como vigentes: cada entrada debe ser revisada, completar sus metadatos y pasar `validateLegalSource`.

Para comprobar accesibilidad y dominio oficial de las fuentes actualmente publicadas:

```bash
npm run catalog:verify
```

El informe se guarda en `data/verification-report.json`. Una URL accesible no demuestra por sí sola vigencia jurídica; el informe exige revisión jurídica para evitar falsos positivos.

El workflow de GitHub Actions `.github/workflows/catalog-monitor.yml` ejecuta semanalmente las pruebas, el descubrimiento y la verificación. Si encuentra cambios, abre un Pull Request con los informes actualizados para revisión. También puede ejecutarse manualmente desde la pestaña **Actions**. La automatización detecta cambios y enlaces rotos, pero no modifica estados jurídicos por sí sola.

## Capacidades

Incluye `buscar_normativa`, `consultar_obligacion`, `verificar_vigencia`, `evaluar_proyecto` y `generar_checklist_auditoria`. También publica los recursos `legal://normativa` y `legal://normativa/{id}`, además del prompt `revision-privacidad`.

Las búsquedas son locales y reproducibles; cada resultado conserva URL oficial, estado y fecha de verificación. El catálogo se valida al iniciar y rechaza URLs no HTTPS, fechas inválidas, campos obligatorios ausentes e identificadores duplicados.

Las respuestas son orientación preliminar con fuentes y fechas de verificación. No constituyen asesoría, dictamen ni certificación jurídica. Antes de una auditoría o decisión empresarial, valida la vigencia en la fuente oficial y consulta a un profesional competente.

### `auditar_repositorio`

Ejecuta una auditoría estática local y de solo lectura sobre un repositorio para detectar señales técnicas de riesgo, con foco en privacidad, seguridad y cumplimiento preliminar.

Entrada ejemplo:

```json
{
  "path": "C:/repos/mi-proyecto",
  "maxDepth": 6,
  "maxFiles": 500,
  "maxFileSizeBytes": 262144
}
```

`path` es el único campo obligatorio. Los límites son opcionales y, si no se envían, se usan valores conservadores por defecto.

La salida incluye:

- `summary`: ruta raíz resuelta, nombre del repositorio, fecha de generación, conteo de archivos y directorios escaneados, entradas omitidas, totales por severidad y categoría, y los límites usados.
- `findings`: hallazgos ordenados por severidad, ruta y línea, con explicación, evidencia redactada cuando corresponde, recomendación, referencia y estado.
- `controls`: controles sugeridos asociados a los hallazgos detectados.
- `references`: fuentes legales o técnicas asociadas a los hallazgos.
- `disclaimer`: aviso de que el reporte es preliminar y no constituye certificación ni dictamen.

La detección de archivos es determinista por extensión, nombre especial y patrón de archivo. Cada archivo escaneado recibe un `language`, cada hallazgo hereda ese campo y el resumen incluye `summary.languages` con el conteo por lenguaje, incluido `unknown`.

Lenguajes y formatos reconocidos:

- JavaScript y TypeScript, incluyendo Vue.
- Python.
- JVM: Java, Kotlin, Scala, Groovy y Gradle.
- .NET: C#, F# y VB.NET.
- Go, Rust, Ruby, C, C++, Swift, Dart, SQL y Shell.
- Configuración: YAML, JSON, JSONC, TOML, `.env`, INI, CFG, CONF, CONFIG y PROPERTIES.
- Infraestructura y contenedores: Docker y Terraform.
- Marcado y documentación: XML, HTML, CSS, Markdown y texto plano.
- Otros admitidos: PHP.

Archivos especiales reconocidos:

- `Dockerfile`, `Containerfile`, `Dockerfile.*`, `Containerfile.*` y `*.dockerfile` se clasifican como `docker`.
- `README`, `LICENSE` y `PRIVACY` se tratan como Markdown.
- `Gemfile` y `Rakefile` se tratan como Ruby.
- `.env*` se tratan como archivos de configuración.
- `*.containerfile`, `*.tf`, `*.tfvars` y `*.hcl` se reconocen para Docker y Terraform.

Cuando un archivo de texto no coincide con ninguna regla conocida, la auditoría lo marca como `unknown`. Eso no impide que se escanee, pero sí limita la precisión de las reglas específicas por familia.

Comportamiento de seguridad:

- escanea solo el sistema de archivos local y no ejecuta código;
- evita directorios excluidos como `node_modules`, `.git`, `dist`, `build`, `.next`, `coverage` y similares;
- omite enlaces simbólicos y rutas que salgan del repositorio;
- limita profundidad, cantidad de archivos y tamaño por archivo;
- ignora archivos binarios y usa solo archivos de texto permitidos;
- redacta valores sensibles detectados en la evidencia antes de devolverlos.

Limitaciones:

- el análisis es heurístico y no sustituye una revisión manual;
- puede omitir problemas en archivos binarios, muy grandes o fuera de los tipos de texto admitidos;
- puede ejecutar opcionalmente escáneres locales de dependencias (`npm audit`, `pip-audit`, `cargo audit`, .NET y `osv-scanner`) cuando estén instalados; si no, lo reporta como omitido;
- los informes pueden renderizarse como JSON, Markdown o HTML compatible con PDF;
- no valida ejecución, configuración en tiempo real ni comportamiento en producción;
- no constituye asesoría, certificación de seguridad ni dictamen jurídico.

## Fuentes

El catálogo solo acepta URLs HTTPS y registros con fecha y estado. Añadir una norma exige conservar su identificador, emisor, URL oficial, fecha de publicación, fecha de verificación y estado normativo.
