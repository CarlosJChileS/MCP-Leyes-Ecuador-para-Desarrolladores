# Configuración en clientes MCP

## Claude Desktop

```json
{
  "mcpServers": {
    "leyes-ecuador": {
      "command": "node",
      "args": ["C:/ruta/leyes-ecuador-dev-mcp/dist/server.js"]
    }
  }
}
```

## Cursor

En `.cursor/mcp.json` use la misma entrada bajo `mcpServers`. En Windows, use rutas absolutas con `/`.

## VS Code

En `.vscode/mcp.json`:

```json
{
  "servers": {
    "leyes-ecuador": {
      "type": "stdio",
      "command": "node",
      "args": ["C:/ruta/leyes-ecuador-dev-mcp/dist/server.js"]
    }
  }
}
```

## npm, pnpm y Bun

```bash
npm run build && npm start
pnpm run build && pnpm start
bun run build && bun start
```

El proceso usa `stdio` y no abre un puerto HTTP. Mantenga `dist/` y `data/` juntos.
