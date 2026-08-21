# Diseño: MCP de leyes de Ecuador para desarrolladores

## Propósito

Construir un servidor Model Context Protocol (MCP) que ayude a desarrolladores, emprendedores y equipos tecnológicos a identificar obligaciones legales aplicables a proyectos digitales en Ecuador, preparar evidencias para auditorías y consultar normativa con fuentes verificables.

El sistema servirá como apoyo informativo y operativo. No sustituirá el criterio de un abogado, auditor, delegado de protección de datos ni autoridad competente.

## Alcance inicial

La primera versión cubrirá:

- Ley Orgánica de Protección de Datos Personales (LOPDP).
- Reglamento General de la LOPDP.
- Resoluciones y guías de la autoridad ecuatoriana de protección de datos.
- Normativa ecuatoriana relacionada con comercio electrónico y firmas electrónicas.
- Protección de consumidores en servicios y productos digitales.
- Propiedad intelectual relevante para software, contenidos y licencias.
- Obligaciones básicas relacionadas con seguridad de la información y tratamiento de incidentes.

No formará parte de la primera versión la emisión de dictámenes jurídicos, la certificación automática de cumplimiento ni la representación ante autoridades.

## Enfoque elegido

Se usará un enfoque híbrido y verificable:

1. Una base local curada conservará metadatos, extractos estructurados, obligaciones, fechas de vigencia y enlaces oficiales.
2. Las respuestas se construirán a partir de esa base para que sean reproducibles y auditables.
3. La actualización de las fuentes se ejecutará como un proceso separado y controlado; una consulta normal no dependerá de extraer información de Internet en tiempo real.
4. Toda respuesta jurídicamente relevante incluirá la fuente, su fecha de verificación y el alcance de la orientación.

## Arquitectura

El proyecto utilizará TypeScript sobre Node.js y el SDK oficial de MCP. La primera interfaz de transporte será `stdio`, compatible con clientes MCP locales. La arquitectura separará:

- **Servidor MCP:** registra recursos, herramientas y mensajes reutilizables.
- **Catálogo normativo:** almacena normas, artículos, obligaciones, autoridades, fechas y referencias oficiales.
- **Motor de consulta:** busca por texto, tema, sector, tipo de dato y etapa del proyecto.
- **Motor de evaluación:** transforma las características declaradas de un proyecto en riesgos, preguntas pendientes y controles sugeridos.
- **Generador de evidencias:** produce listas de verificación y matrices exportables, sin declarar por sí mismo que existe cumplimiento legal.
- **Validador de fuentes:** rechaza registros sin procedencia, fecha de verificación o identificador normativo.

Cada componente tendrá interfaces explícitas para permitir reemplazar el formato de almacenamiento o agregar búsqueda semántica sin cambiar el contrato MCP.

## Capacidades MCP iniciales

### Herramientas

- `buscar_normativa`: busca normas y obligaciones por palabras clave y filtros.
- `consultar_obligacion`: explica una obligación y devuelve sus referencias oficiales.
- `evaluar_proyecto`: recibe características de un sistema y devuelve riesgos, preguntas y controles sugeridos.
- `generar_checklist_auditoria`: crea una lista de evidencias por tema y tipo de organización.
- `verificar_vigencia`: muestra el estado y la última fecha de verificación de una fuente.

### Recursos

- Índice de normas incluidas.
- Fichas normativas estructuradas.
- Glosario de protección de datos y cumplimiento tecnológico.
- Catálogo de controles y evidencias recomendadas.

### Mensajes reutilizables

- Revisión de privacidad de un proyecto nuevo.
- Preparación para una auditoría.
- Evaluación preliminar de un proveedor tecnológico.

## Flujo de datos

1. El cliente MCP envía una consulta estructurada.
2. El servidor valida campos, tamaños y valores permitidos.
3. El motor consulta el catálogo y conserva la trazabilidad de cada resultado.
4. Si corresponde, el motor de evaluación aplica reglas explícitas a los datos declarados por el usuario.
5. La respuesta distingue hechos normativos, inferencias, información faltante y recomendaciones.
6. El servidor adjunta fuentes, fecha de verificación y aviso de alcance.

## Datos y trazabilidad

Cada registro normativo incluirá como mínimo:

- Identificador estable.
- Título oficial y tipo de norma.
- Emisor y jurisdicción.
- Fecha de publicación, vigencia y última verificación.
- URL oficial.
- Artículos o secciones relacionados.
- Temas, sujetos obligados y palabras clave.
- Estado: vigente, reformado, derogado o pendiente de verificación.

El contenido pendiente de verificación no se presentará como una obligación vigente.

## Seguridad y privacidad

- El servidor local no conservará datos personales enviados en consultas salvo que el usuario configure expresamente un almacenamiento posterior.
- Los registros evitarán incluir secretos, credenciales o expedientes reales.
- Se limitarán el tamaño de entradas y las rutas de archivos permitidas.
- Los mensajes de error no expondrán datos sensibles ni detalles internos innecesarios.
- Las capacidades que modifiquen archivos o consulten servicios externos se mantendrán separadas y desactivadas de forma predeterminada.

## Manejo de errores

El servidor devolverá errores estructurados y comprensibles para entradas inválidas, fuentes ausentes, normas no verificadas y consultas sin resultados. Una ausencia de resultados nunca se interpretará como ausencia de obligaciones legales. Cuando falte información del proyecto, la evaluación indicará qué datos se necesitan en lugar de inventarlos.

## Pruebas

La primera versión incluirá:

- Pruebas unitarias del catálogo, validadores y reglas de evaluación.
- Pruebas de contrato para herramientas y recursos MCP.
- Casos de consulta con y sin resultados.
- Pruebas que exijan fuente y fecha en cada respuesta normativa.
- Pruebas de rechazo de datos normativos incompletos o no verificables.
- Pruebas de seguridad para entradas excesivas, rutas no autorizadas y contenido sensible.

## Criterios de aceptación

La primera versión estará lista cuando:

- Se pueda iniciar localmente mediante un comando documentado.
- Un cliente MCP pueda descubrir y ejecutar todas las herramientas iniciales.
- Las consultas devuelvan resultados con fuentes oficiales y fechas de verificación.
- La evaluación de un proyecto produzca riesgos, controles y preguntas pendientes sin emitir una certificación jurídica.
- La lista de verificación para auditoría sea reproducible con los mismos datos de entrada.
- Todas las pruebas automatizadas pasen.

## Evolución posterior

Una fase posterior podrá incorporar transporte HTTP, autenticación, actualización asistida de fuentes oficiales, búsqueda semántica, exportación a formatos de auditoría e integración opcional con un servicio Python de análisis documental.
