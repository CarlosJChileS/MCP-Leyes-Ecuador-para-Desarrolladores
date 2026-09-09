# Política de privacidad

**Última actualización:** 9 de septiembre de 2026

Esta política describe el funcionamiento de `leyes-ecuador-dev-mcp`, un servidor MCP local para auditoría técnica, gobernanza de datos y consulta de normativa tecnológica ecuatoriana.

## 1. Responsable y alcance

El proyecto es mantenido por Carlos Chile. Esta política cubre el software, el repositorio y el paquete npm. No cubre las políticas de privacidad del cliente MCP, del asistente de inteligencia artificial, de npm, GitHub ni de las fuentes oficiales consultadas.

## 2. Datos que puede tratar el software

El servidor puede procesar localmente archivos y nombres de archivos del repositorio indicado, configuración y manifiestos de dependencias, parámetros enviados por el cliente MCP, informes, evidencias, responsables y fechas que el usuario decida guardar, y documentos públicos descargados desde fuentes oficiales.

El servidor no solicita cuentas, contraseñas, tarjetas, identificadores personales ni datos de contacto. Puede encontrar accidentalmente datos personales o secretos dentro de un repositorio auditado; el usuario debe excluirlos o eliminarlos antes de compartir resultados.

## 3. Finalidades y base de uso

El tratamiento local se realiza para analizar el proyecto solicitado, generar informes, consultar el catálogo jurídico y administrar el ciclo de vida de auditorías. El usuario determina qué ruta, datos y fuentes proporciona. El uso en producción debe documentarse con la base jurídica y las medidas que correspondan al responsable del tratamiento.

## 4. Procesamiento local y transferencias

Las búsquedas del catálogo y la auditoría estática se ejecutan localmente. El servidor no envía el código a un modelo ni mantiene telemetría propia. Sin embargo, el cliente MCP puede enviar las respuestas a un proveedor de IA según sus propias políticas.

Las verificaciones y descargas acceden a internet. `dependencyScan: true` puede ejecutar herramientas externas que consultan bases de vulnerabilidades. No active esas funciones en repositorios sensibles sin revisar las políticas de cada servicio.

## 5. Almacenamiento y conservación

El servidor no guarda informes por defecto. Si se usa `persist: true`, los datos quedan en `.mcp-governance/`, incluyendo auditorías, evidencias, responsables, fechas, excepciones e historial. El usuario administra acceso, respaldo y eliminación de esos archivos.

Debe definirse un plazo de conservación según la finalidad, obligaciones, contratos y política interna del responsable. Evite almacenar secretos o datos personales innecesarios.

## 6. Seguridad

El análisis estático no ejecuta el código auditado, limita el recorrido y redacta valores sensibles como protección de mejor esfuerzo. Esto no garantiza anonimización. Revise los resultados antes de publicarlos y use un entorno aislado para código no confiable. Consulte [SECURITY.md](SECURITY.md).

## 7. Derechos y consultas

Las solicitudes relacionadas con datos tratados por una organización usuaria deben dirigirse a esa organización, que actúa como responsable del tratamiento. Para consultas sobre el software o reportes de seguridad, use los canales privados indicados en el repositorio y no incluya información sensible en issues públicos.

## 8. Cambios

Las modificaciones de esta política se publicarán junto con una actualización del repositorio y su fecha. Esta política es documentación técnica informativa y debe ser revisada por un profesional competente antes de adoptarse como política corporativa.
