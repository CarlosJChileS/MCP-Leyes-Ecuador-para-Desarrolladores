# Diseño: matriz integral de cumplimiento ecuatoriano

## Objetivo

Ampliar la evaluación del MCP para que cualquier proyecto reciba una matriz accionable de cumplimiento, no solo una lista de referencias. La respuesta debe distinguir obligaciones aplicables, condicionales y no aplicables, explicar el motivo, indicar evidencia, prioridad, riesgo y criterio de cierre.

## Alcance

La evaluación cubrirá las normas disponibles en el catálogo relacionadas con protección de datos personales, privacidad, seguridad, encargados, proveedores, transferencias, contratos, comercio electrónico, consumidores y facturación electrónica. Las obligaciones tributarias o sectoriales solo se declararán aplicables cuando exista una fuente documentada en el catálogo y el perfil del proyecto active esa condición.

El MCP evaluará proyectos con datos personales o financieros, proveedores tecnológicos y comprobantes según el perfil declarado o inferido. No declarará cumplimiento jurídico definitivo: estados y vigencia quedarán sujetos a evidencia y revisión humana.

## Contrato de salida

`evaluar_proyecto`, `generar_checklist_auditoria` y `generar_informe_gobernanza` expondrán una matriz con:

- norma, identificador, artículo y fuente oficial;
- obligación y condición de aplicación;
- explicación de por qué aplica o no aplica;
- evidencia requerida y evidencia registrada;
- estado: `pendiente`, `en_progreso`, `cumple`, `no_cumple`, `no_aplica`, `aceptada_temporalmente` o `requiere_revision_legal`;
- prioridad, riesgo, responsable, fecha límite y criterio de cierre;
- advertencia de vigencia cuando la fuente esté pendiente de verificación.

Los valores derivados por el MCP serán conservadores: una obligación sin evidencia comienza como `pendiente`; una norma sin vigencia jurídica confirmada se marca `requiere_revision_legal` y nunca como `cumple`.

## Flujo

1. Validar y normalizar el perfil del proyecto.
2. Seleccionar fuentes por temas y condiciones del perfil.
3. Expandir las obligaciones documentadas de cada fuente.
4. Clasificar aplicabilidad, prioridad y riesgo mediante reglas explícitas.
5. Asociar controles y evidencias detectadas por la auditoría técnica.
6. Devolver matriz, resumen ejecutivo, preguntas faltantes y referencias.
7. Si se solicita persistencia, guardar acciones y cambios en `.mcp-governance` sin borrar historial.

## Compatibilidad y seguridad

Se conservarán los campos actuales (`risks`, `controls`, `questions`, `references`) y se añadirán campos nuevos. No se afirmará que una ausencia de hallazgos equivale a cumplimiento. Las fuentes, estados y recomendaciones conservarán el aviso legal existente.

## Pruebas

Se añadirán pruebas para perfiles personales con proveedores, perfiles comerciales con ventas, obligaciones sin catálogo, estados y vigencia pendiente, además de una prueba MCP por `stdio` que compruebe la matriz completa y su persistencia.
