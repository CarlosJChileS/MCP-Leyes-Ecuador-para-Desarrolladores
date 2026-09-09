# Release readiness

## Estado

El servidor MCP es técnicamente publicable como paquete local para Node.js 20+.
Antes de una versión de producción deben pasar:

```bash
npm run verify:all
pnpm run verify:all
bun run verify:all
```

Los tres gestores ejecutan los mismos scripts. El paquete publicado contiene `dist/`, `data/normativa.json` y la documentación necesaria; no contiene pruebas, `.release-work` ni dependencias de desarrollo.

## Compatibilidad

- npm 10+
- pnpm 9+
- Bun 1.1+
- Node.js 20+

Bun puede ejecutar el servidor, pero el runtime recomendado para clientes MCP es Node.js 20+ por compatibilidad amplia con el ecosistema MCP.

## Publicación

```bash
npm pack --dry-run
npm publish --access public
npm run checksum -- eculegaldev-1.0.0.tgz
```

La publicación requiere revisión del catálogo jurídico, actualización de `version` y validación del `CHANGELOG.md`.

## Limitación jurídica

La verificación automática comprueba accesibilidad y metadatos registrados. No certifica vigencia, derogación, reformas ni aplicabilidad jurídica. Cada cambio normativo debe ser revisado por una persona competente antes de incorporarse.
