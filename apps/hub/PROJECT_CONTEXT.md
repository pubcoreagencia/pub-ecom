# Project Context — PUB ECOM / PubecomHub

> **Regra Permanente do Projeto:** O Git é a fonte compartilhada de verdade entre todas as IAs e desenvolvedores. Antes de executar qualquer tarefa, consuma este contexto oficial. Após qualquer avanço relevante, atualize este documento antes de encerrar o ciclo.

---

## 1. Visão Geral da Arquitetura

O **PUB ECOM** é uma plataforma de e-commerce e catálogo master multi-tenant alimentada por Cloudflare Workers, D1 e Supabase.

* **Frontend & BFF Hub (`pubecomhub`):** TanStack Start, React 19, TailwindCSS v4, Vite 8, Nitro (Cloudflare module preset). Responsável pela UI, autenticação de sessão, dashboard e proxy seguro para o Catalog Worker.
  * **Wrangler Service:** `pubcoreagencia-pubecomhub`
  * **Domínio de Produção:** `https://pubcoreagencia-pubecomhub.contato-pubcore.workers.dev`
  * **Bindings Ativos:** `env.CATALOG_WORKER` (Service Binding para `pub-ecom-catalog-worker`), `env.ASSETS`
* **Catalog Worker (`catalog-worker`):** Serviço core de catálogo, extração e persistência em banco SQLite D1.
  * **Wrangler Service:** `pub-ecom-catalog-worker`
  * **Domínio Público / Health:** `https://pub-ecom-catalog-worker.contato-pubcore.workers.dev`
  * **Bindings Ativos:** `env.DB` (Cloudflare D1: `pub-ecom-master-catalog`), `env.BROWSER` (Cloudflare Browser Rendering via `@cloudflare/puppeteer`)
* **Transporte Hub ↔ Catalog Worker:** **Cloudflare Service Binding** (`CATALOG_WORKER.fetch(...)`), eliminando erros de proxy HTTP público e Cloudflare Error 1042.
* **Banco de Dados Relacional:**
  * **Supabase PostgreSQL:** Auth, perfis de usuários, isolamento multi-tenant (RLS) para lojistas e administradores.
  * **Cloudflare D1 (SQLite):** Catálogo mestre unificado (`products`, `stores`, `sync_runs`).
* **Scraper Authority & Automação:** Apify (`pub-shopee-scraper`) e Browser Run.

---

## 2. Pipeline de Importação por URL (Estratégia L3 Híbrida & Zero-Mock)

O fluxo de importação por URL adota a cascata automatizada com resiliência a desafios e anti-bot:

```text
Usuário insere URL
↓
Hub BFF (/api/catalog/import/analyze)
↓ (Supabase JWT Validado & Service Binding)
Catalog Worker (/v1/catalog/import/analyze)
↓
SSRF Check & Detecção de Provedor (Mercado Livre, Shopee, Amazon, TikTok Shop, Genérico)
↓
[Passo 0] clientCollectedData fornecido? → Validação Estrita Zero-Mock → Se válido: 200 OK
↓
[Passo 1] L1 HTTP (OpenGraph / Meta Tags / JSON-LD passivo) → Se completo: 200 OK
↓
[Passo 2] L3 Browser Run Remoto (Cloudflare Puppeteer @cloudflare/puppeteer)
↓
Classificação de Página:
├─ PRODUCT_PAGE → Extração completa de DOM/Hydration → 200 OK
├─ ACCOUNT_VERIFICATION / CAPTCHA / ACCESS_DENIED / INTERSTITIAL → assistedRequired: true (200)
└─ EMPTY / Incompleto → 422 Unprocessable Entity
↓ (Se assistedRequired)
Frontend Hub UI entra em estado ASSISTED_REQUIRED
↓
Leitura Assistida no Navegador Local (DOM/JSON-LD sanitizado)
↓
Reenvio de clientCollectedData para o Catalog Worker
↓
Validação Server-Side Zero-Mock (Rejeita "Produto Importado", "49.90", Unsplash, mock)
↓
Geração de Preview Comercial (Preço de Custo, Margem, Lucro Projetado) → 200 OK
↓
Lojista revisa / edita e clica em "Importar Produto"
↓
POST /v1/catalog/import/commit → D1 Database (201 Created / 200 ALREADY_IMPORTED)
```

---

## 3. Classificação de Páginas & Detecção de Desafios

Implementada no `BrowserWorker.ts` sob a interface `BrowserWorkerResult`:

* `PRODUCT_PAGE`: Página de produto válida com título, preço e galeria de imagens localizados.
* `ACCOUNT_VERIFICATION`: Bloqueio por exigência de login / verificação de conta (ex.: Mercado Livre `/gz/account-verification`, "Para continuar, acesse sua conta", `negative_traffic`).
* `CAPTCHA`: Desafios visuais/interativos do Cloudflare Turnstile, Arkose Labs ou reCAPTCHA.
* `ACCESS_DENIED`: Respostas 403 WAF / bloqueios de IP de datacenter.
* `INTERSTITIAL`: Telas intermediárias de consentimento, cookies ou redirecionamentos sem dados de produto.
* `EMPTY`: Respostas vazias ou sem corpo DOM.

Quando `isBlockedInterstitial: true` ou uma classificação de bloqueio é emitida, o Catalog Worker responde com:
```json
{
  "success": false,
  "assistedRequired": true,
  "reason": "ACCOUNT_VERIFICATION",
  "message": "Não conseguimos acessar esta página diretamente. Estamos usando uma leitura assistida do navegador para capturar o produto.",
  "url": "https://...",
  "marketplace": "mercadolivre",
  "externalId": "MLB67444410"
}
```

---

## 4. Política Estrita Zero-Mock

É terminantemente proibido o uso de dados sintéticos ou placeholders de demonstração:
1. Rejeição ativa de títulos contendo `Produto Importado` ou `mock`.
2. Rejeição de preços default (`49.90` ou valores não numéricos/negativos).
3. Rejeição de URLs de imagens vindas de `images.unsplash.com` ou `via.placeholder`.
4. Validação de correspondência entre `sourceUrl`, `externalId` e produto extraído.
5. Em caso de falha de extração em páginas sem produto real, o backend emite `HTTP 422` com `error: "Dados reais do produto não puderam ser extraídos"`.

---

## 5. Histórico de Problemas Investigados e Soluções

| Problema Anterior | Causa Raiz Diagnosticada | Solução Definitiva Aplicada | Status |
| :--- | :--- | :--- | :--- |
| **HTTP 404 no Analyze** | Fetch público do Hub para Catalog Worker resultava em Cloudflare Error 1042 (cross-worker fetch dentro da mesma zona). | Configurado **Cloudflare Service Binding** `CATALOG_WORKER` no `wrangler.jsonc` do Hub, roteando direto via IPC seguro sem salto HTTP público. | **RESOLVIDO** |
| **Erro de Binding BROWSER** | Tentativa de chamar `env.BROWSER.launch()` diretamente. | Utilizado `@cloudflare/puppeteer` oficial via `puppeteer.launch(env.BROWSER)`. | **RESOLVIDO** |
| **Bloqueio WAF Mercado Livre** | Mercado Livre bloqueia instâncias de browser em datacenter via `/gz/account-verification`. | Implementada classificação explícita de páginas + pipeline de **Assisted Fallback** no frontend com validação Zero-Mock no backend. | **RESOLVIDO** |
| **401 em rotas públicas de importação** | O gate de autenticação do Catalog Worker exigia token em todas as rotas. | Liberado acesso a `/v1/catalog/import/*` e `/v1/catalog/products` quando chamadas via Service Binding ou públicas. | **RESOLVIDO** |

---

## 6. CURRENT STATE

### 6.1 Serviços em Produção
* **Hub Worker:** `https://pubcoreagencia-pubecomhub.contato-pubcore.workers.dev`
* **Catalog Worker:** `https://pub-ecom-catalog-worker.contato-pubcore.workers.dev`
* **D1 Master Database:** `pub-ecom-master-catalog` (ID: `9d565ef9-f1c5-4af0-ac91-52411ac88d45`)
* **Supabase PostgreSQL:** Auth + RLS multi-tenant ativo.

### 6.2 Validações E2E Realizadas e Comprovadas
1. **Mercado Livre (Homologação Oficial):**
   * URL: `https://www.mercadolivre.com.br/smartphone-motorola-edge-70-fusion-5g-fifa-world-cup-collection-256gb-24gb-8gb-ram-16gb-ram-boost-camera-50mp-sony-lytia-710-tela-15k-extreme-amoled-grafite/p/MLB67444410`
   * Resultado: `HTTP 200 OK`
   * Título Real: `Smartphone Motorola Edge 70 Fusion 5g Fifa World Cup Collection - 256gb 24gb...`
   * Preço Real: `R$ 3.799,10`
   * Imagens Reais: 5 imagens CDN do Mercado Livre
   * External ID: `MLB67444410`
2. **Ciclo de Commit & D1:**
   * 1ª Importação: `HTTP 201 Created` (`status: "IMPORTED"`)
   * 2ª Importação (Idempotência): `HTTP 200 OK` (`status: "ALREADY_IMPORTED"`)
   * Consulta D1 (`GET /v1/catalog/products?search=MLB67444410`): Produto persistido e verificado com integridade.
3. **Shopee & TikTok Shop:**
   * Detecção de interstitial e disparo automático de `assistedRequired: true` validado com sucesso.
4. **Amazon & Lojas Genéricas:**
   * Proteção Zero-Mock validada (páginas inacessíveis retornam `422` e não poluem o catálogo com dados falsos).

---

## 7. AI HANDOFF

Para que qualquer agente ou engenheiro de IA continue o desenvolvimento com total alinhamento:

### 7.1 O que já está pronto e NÃO deve ser alterado
1. **NÃO altere o Service Binding `CATALOG_WORKER`** no Hub. O roteamento interno está estável e blindado contra o erro 1042.
2. **NÃO invente scrapers paralelos nem crie métodos mock** com preços fixos ou imagens de placeholder.
3. **NÃO utilize `env.BROWSER.launch()` diretamente**; sempre passe o binding para `@cloudflare/puppeteer` (`puppeteer.launch(env.BROWSER)`).
4. **NÃO quebre o pipeline de fallbacks L1 → L3 → Assisted Fallback**.

### 7.2 Arquivos Críticos do Projeto
* `catalog-worker/src/index.ts`: Ponto de entrada do Catalog Worker, roteador de Analyze e Commit, e persistência D1.
* `catalog-worker/wrangler.toml`: Configuração oficial dos bindings D1 e Browser do Catalog Worker.
* `wrangler.jsonc`: Configuração oficial do Hub com Service Binding `CATALOG_WORKER`.
* `src/server/catalogProxy.ts`: BFF proxy no Hub que autentica a sessão Supabase e delega via `env.CATALOG_WORKER.fetch()`.
* `src/lib/api/urlImport.ts`: Cliente frontend para disparo de análise, fallback assistido e commit.
* `src/components/import/UrlProductImportPage.tsx`: Interface do usuário para inserção da URL, visualização dos estados `ANALYZING`/`ASSISTED_REQUIRED`, edição de markup e commit.
* `pub-actors/pub-actors/packages/url-import-engine/src/workers/BrowserWorker.ts`: Motor de classificação de páginas e renderização headless compatível com Cloudflare Puppeteer.

### 7.3 Comandos Essenciais

```bash
# Compilar e validar o Catalog Worker
cd catalog-worker
npm run build
npm run typecheck
npx wrangler deploy dist/index.js --config wrangler.toml

# Compilar e validar o Hub
cd ..
npm run build
npx wrangler deploy

# Executar testes unitários
npm test
```

### 7.4 Variáveis de Ambiente e Secrets
* `SUPABASE_URL` / `SUPABASE_ANON_KEY`: Conexão com o banco relacional e autenticação GoTrue.
* `SUPABASE_SERVICE_ROLE_KEY`: Acesso administrativo restrito a funções server-side.
* `CATALOG_WORKER_TOKEN`: Token opcional para chamadas públicas externas ao Catalog Worker.
* `APIFY_TOKEN`: Token de integração com o scraper da Shopee via Apify.

### 7.5 Próximos Passos Recomendados
1. Expandir a galeria de visualização de variações de produtos importados na UI de ingestão (`UrlProductImportPage.tsx`).
2. Adicionar webhooks de sincronização de preço em lote para produtos já persistidos no D1.
3. Implementar exportação de produtos do D1 Master Catalog para lojas Shopify/WooCommerce conectadas.

