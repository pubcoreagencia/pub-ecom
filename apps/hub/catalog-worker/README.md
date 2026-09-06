# PUB ECOM Catalog Worker

Worker independente para automação de browser (scraping) do PUB ECOM HUB utilizando Cloudflare Browser Run.

## Funcionalidades

- **Health Check**: `GET /health`
- **Ingestion Shopee**: `POST /ingestion/shopee`
- **Segurança**:
  - Autenticação via Bearer Token.
  - Validação de Hostname (Apenas Shopee).
  - Proteção SSRF básica.
- **Runtime**: Cloudflare Workers com `browser` binding.

## Desenvolvimento

```bash
cd catalog-worker
npm install
npm run typecheck
npm run dev
```

## Deploy

```bash
# Configurar token secreto (Primeira vez)
npx wrangler secret put CATALOG_WORKER_TOKEN

# Deploy
npm run deploy
```

## Estrutura

- `src/index.ts`: Ponto de entrada e handlers.
- `wrangler.toml`: Configuração do worker e bindings.
- `tsconfig.json`: Configuração TypeScript para o worker.
