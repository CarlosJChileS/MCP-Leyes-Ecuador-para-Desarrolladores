# Diseño: auditoría integral de repositorios

## Objetivo

Agregar al MCP una herramienta `auditar_repositorio` que inspeccione un repositorio local de forma estática y produzca hallazgos técnicos y preliminares de cumplimiento legal ecuatoriano. La herramienta será de solo lectura: no ejecutará código del proyecto, no instalará dependencias y no modificará archivos.

## Alcance funcional

La auditoría recibirá una ruta de repositorio y opciones opcionales de profundidad. Recorrerá únicamente archivos permitidos dentro de esa ruta, ignorando directorios generados, dependencias instaladas, artefactos de compilación y archivos binarios.

Analizará:

- secretos, tokens, contraseñas y claves privadas expuestas;
- dependencias declaradas y señales de versiones obsoletas o inseguras;
- autenticación, autorización y endpoints sensibles;
- almacenamiento o transmisión de datos personales;
- logs que puedan contener datos privados;
- cifrado, cookies, CORS, headers y configuraciones inseguras;
- documentación de privacidad, retención, consentimiento e incidentes;
- controles y evidencias asociables a las normas del catálogo.

Cada hallazgo incluirá identificador, severidad, categoría, archivo y línea cuando sea posible, explicación, evidencia, recomendación, referencia normativa y estado `pendiente`.

## Arquitectura

Se añadirá un módulo de análisis estático separado del servidor MCP:

- `src/audit.ts`: tipos, recorrido seguro, reglas y agregación del informe.
- `src/server.ts`: registro de `auditar_repositorio` y serialización de respuesta.
- `tests/audit.test.ts`: pruebas unitarias con repositorios temporales o fixtures controlados.

El catálogo legal seguirá siendo la fuente de referencias. Las reglas serán deterministas y locales. La herramienta tendrá límites de tamaño, extensiones permitidas, exclusión de rutas y protección contra salir de la ruta solicitada mediante traversal o enlaces no controlados.

## Flujo de datos

1. Validar y resolver la ruta proporcionada.
2. Confirmar que existe y es un directorio.
3. Enumerar archivos dentro del directorio permitido.
4. Aplicar exclusiones y límites.
5. Ejecutar reglas por archivo y reglas globales del repositorio.
6. Asociar hallazgos con fuentes del catálogo.
7. Calcular resumen por severidad y categoría.
8. Devolver informe, checklist y descargo legal.

No se enviará contenido del repositorio a servicios externos.

## Reglas iniciales

Las reglas iniciales serán heurísticas transparentes, no un escáner certificado. Detectarán patrones de secretos conocidos, uso de datos personales en código, logs de objetos sensibles, HTTP inseguro, configuraciones permisivas, autenticación débil o ausente en rutas sensibles, dependencias declaradas y documentación de privacidad faltante. Los resultados deberán indicar que son señales para revisión humana y evitar afirmar vulnerabilidades cuando solo exista una coincidencia textual.

## Manejo de errores

Las rutas inválidas, archivos ilegibles o repositorios demasiado grandes producirán errores claros o advertencias parciales sin detener innecesariamente los demás análisis. Nunca se incluirán secretos completos en la respuesta; la evidencia sensible se redactará y mostrará solo una vista parcial segura.

## Pruebas y aceptación

Se comprobará que:

- la herramienta aparece en `tools/list`;
- un repositorio de fixture genera hallazgos esperados;
- los secretos se redactan;
- no se leen rutas fuera del repositorio;
- las exclusiones y límites funcionan;
- el informe contiene severidades, evidencia, controles, referencias y descargo;
- las pruebas existentes y el build siguen pasando;
- el handshake MCP continúa funcionando.

## Limitaciones explícitas

La herramienta no reemplaza una auditoría profesional, análisis dinámico, pentest, revisión contractual ni dictamen jurídico. La ausencia de hallazgos no demuestra cumplimiento ni seguridad.
