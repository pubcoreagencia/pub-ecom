# Auditoria de Integração: PUB ECOM & Browser Importer (FASE 16)

Este documento estabelece o mapeamento forense e a arquitetura técnica do ecossistema **PUB ECOM**, identificando os pontos exatos para acoplamento do **Browser Importer** sem impactar a produção.

---

## 1. Arquitetura Identificada

O ecossistema **PUB ECOM** opera sob uma arquitetura híbrida de alto desempenho:

1. **Frontend / Application Server**:
   * **Framework**: TanStack Start + React 19 + TanStack Router (Vite / SSR).
   * **Localização**: `pubecomhub/src/`.
   * **Camada de Dados**: React Server Functions (`createServerFn`), Server Handlers e Repositórios.

2. **Catalog Worker (Edge Engine)**:
   * **Runtime**: Cloudflare Workers + Cloudflare D1 (SQLite distribuído).
   * **Localização**: `pubecomhub/catalog-worker/`.
   * **Função**: Ingestão veloz, catálogo global de lojas e sincronização com baixa latência.

3. **Core Database (Supabase PostgreSQL)**:
   * **Modelo**: PostgreSQL com Row Level Security (RLS).
   * **Entidades**: `master_products`, `products`, `suppliers`, `profiles`, `orders`.

---

## 2. Tabelas e Esquema do Catálogo

### A. Cloudflare D1 (`catalog-worker/schema.sql`)
* **`stores`**: `id`, `name`, `username`, `source`, `shop_id`, `status`, `sync_state`, `product_count`, `last_sync_at`, `metadata`.
* **`products`**: `id`, `external_id`, `store_id`, `title`, `description`, `price`, `currency`, `images` (JSON array), `url`, `sku`, `category`, `source`, `metadata`, `created_at`, `updated_at`.
  * **Chave Única**: `UNIQUE(store_id, external_id)` — Garante proteção nativa contra duplicação no D1.
* **`sync_runs`**: Registro histórico de execuções.

### B. Supabase PostgreSQL (`master_products`)
* **`master_products`**: `id`, `supplier_id`, `sku`, `name`, `description`, `image_url`, `category`, `supplier_cost`, `base_price_pub`, `status`, `is_available`, `metadata`.

---

## 3. Autenticação e Isolamento de Tenants

1. **Camada de Aplicação**:
   * Middleware `requireSupabaseAuth` valida JWT do usuário.
   * Controle de acesso baseado em papéis (`MASTER`, `FORNECEDOR`, `LOJISTA`).
2. **Camada Edge (Catalog Worker)**:
   * Token estático `Authorization: Bearer ${CATALOG_WORKER_TOKEN}`.
   * Isolamento por `store_id` / `supplier_id`.

---

## 4. Estratégia de Integração Proposta

```
Chrome Real (Aba do Usuário)
       ↓
Browser Collector / Importer
       ↓
PubEcomProduct (Canônico Auditado)
       ↓
POST /v1/import/products (ou POST /api/import/products)
       ↓
[Feature Flag: BROWSER_IMPORT_ENABLED]
       ↓
[Validação Zod + Zero Mock + Deduplicação]
       ↓
Persistência D1 / Master Products
```

* **Deduplicação**: Composta por `(store_id / tenant_id, source, external_id)`. Se já existir, retorna `{ success: true, status: "ALREADY_IMPORTED", productId }`.
* **Proveniência**: Preservada integralmente no campo `metadata.provenance`.
* **Imagens & Variantes**: Preservadas nas colunas `images` e `metadata.variants`.
* **Zero Risco**: Protegido por `BROWSER_IMPORT_ENABLED` (padrão desligado em produção).
