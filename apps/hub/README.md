# PUB ECOM HUB

Plataforma unificada de gestão de e-commerce, catálogo B2B, intermediação de fornecedores e ingestão operacional da **Pub Core Holding**.

## Arquitetura

```
PUB ECOM
├── Frontend: TanStack Start + React 19 + Vite + Tailwind CSS
├── Runtime / Hosting: Cloudflare Workers (@cloudflare/vite-plugin)
├── Auth & Database: Supabase Oficial (Project ID: vtcnundfslqqlxdyrogv)
├── Catalog Hub: pubcoreagencia-pubecomhub
├── Catalog Worker: pub-ecom-catalog-worker
└── Shopee Scraper: Ingestion Engine + Apify
```

## Desenvolvimento Local

```sh
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Validar TypeScript e construir bundle de produção
npm run build

# Executar testes unitários e de integração
npx vitest run
```

## Deploy

```sh
# Deploy para Cloudflare Workers
npm run deploy
```
