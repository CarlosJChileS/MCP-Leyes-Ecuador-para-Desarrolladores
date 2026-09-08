# Seguridad

## Modelo de confianza

Este servidor MCP local opera con los permisos de la cuenta que lo inicia. El cliente debe autorizar las rutas y las llamadas a herramientas. No es un sandbox ni un servicio multiusuario.

El análisis estático no ejecuta el código del repositorio. Omite enlaces simbólicos, dependencias y builds; limita profundidad, cantidad de archivos y tamaño por archivo. `.mcp-audit.json` debe ser un archivo regular de hasta 64 KiB. Las exclusiones se aplican antes de leer el contenido. Los valores de configuración no pueden elevar los máximos de la herramienta.

La redacción de secretos y datos personales es una protección de mejor esfuerzo, no una garantía de anonimización. Revise los reportes antes de compartirlos. Las rutas y los nombres de archivos se incluyen en las respuestas. Los límites de recorrido y las omisiones hacen que un reporte sin hallazgos no demuestre ausencia de problemas.

`dependencyScan: true` ejecuta herramientas externas. Úselo solo en proyectos de confianza: resolutores, plugins o comandos de terceros pueden acceder a red, credenciales, cachés y metadatos del proyecto. No se promete aislamiento de procesos descendientes ni seguridad frente a cambios concurrentes maliciosos del filesystem. Para código hostil, ejecute todo el MCP dentro de un entorno aislado y use únicamente el análisis estático.

Las consultas al catálogo son locales. Los scripts de descubrimiento/verificación consultan fuentes oficiales; los escáneres de dependencias consultan sus bases de vulnerabilidades. No hay telemetría propia ni envío del código a un modelo por el servidor. El cliente MCP tiene sus propias políticas de tratamiento de las respuestas.

## Reportar problemas

No publique credenciales ni repositorios privados en issues. Use el canal de reporte privado de GitHub si está habilitado; de lo contrario, solicite un canal privado al mantenedor sin divulgar los detalles sensibles. Para errores no sensibles, abra un issue con versión, sistema operativo y pasos de reproducción mínimos.

## Versiones

La rama principal recibe correcciones. Las publicaciones se identifican por versión; use el historial de cambios y las ejecuciones de CI como evidencia de lo efectivamente validado. Las herramientas externas requieren instalación y actualización independientes.
