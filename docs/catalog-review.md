# Revisión del catálogo jurídico

## Flujo reproducible

```bash
npm run catalog:discover
npm run catalog:verify
npm run catalog:import
npm run catalog:review
npm run catalog:coverage
```

Los comandos equivalentes funcionan con `pnpm run` y `bun run`.

## Criterios de incorporación

Una fuente solo se incorpora al catálogo publicado después de:

1. Confirmar que proviene de un dominio oficial.
2. Registrar título, tipo, fecha, identificador y URL.
3. Conservar evidencia de Registro Oficial cuando exista.
4. Revisar manualmente reformas, derogaciones, sustituciones y ámbito.
5. Marcar por separado accesibilidad, revisión documental y vigencia jurídica.
6. Ejecutar pruebas y revisar el cambio antes de publicar.

Una fuente descubierta automáticamente permanece pendiente; nunca se interpreta como norma vigente por defecto.
