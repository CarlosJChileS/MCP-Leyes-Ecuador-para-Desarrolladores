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

## Capacidades

Incluye `buscar_normativa`, `consultar_obligacion`, `verificar_vigencia`, `evaluar_proyecto` y `generar_checklist_auditoria`.

Las respuestas son orientación preliminar con fuentes y fechas de verificación. No constituyen asesoría, dictamen ni certificación jurídica. Antes de una auditoría o decisión empresarial, valida la vigencia en la fuente oficial y consulta a un profesional competente.

## Fuentes

El catálogo solo acepta URLs HTTPS y registros con fecha y estado. Añadir una norma exige conservar su identificador, emisor, URL oficial, fecha de publicación, fecha de verificación y estado normativo.
