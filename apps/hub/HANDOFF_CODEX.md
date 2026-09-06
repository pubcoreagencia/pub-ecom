# Codex Handoff — Catalog Import Engine & Hybrid L3 Pipeline

Este documento serve como relatório de handoff técnico sobre a resolução definitiva do fluxo de importação por URL (`POST /api/catalog/import/analyze` e `POST /api/catalog/import/commit`), com arquitetura híbrida L3 e defesa Zero-Mock.

---

## 1. Resumo do Estado Atual

> [!NOTE]
> **Estado:** RESOLVIDO E HOMOLOGADO EM PRODUÇÃO ✅
> O erro 404 (Cloudflare Error 1042) foi resolvido definitivamente via Cloudflare Service Binding. O pipeline de importação funciona de ponta a ponta com suporte a extração passiva L1, renderização L3 (@cloudflare/puppeteer), classificação de interstitial e Assisted Fallback no frontend com validação server-side Zero-Mock.

---

## 2. Workers & URLs Envolvidos

- **Hub Worker (Frontend & BFF Proxy):**
  - **Serviço Wrangler:** `pubcoreagencia-pubecomhub`
  * **Versão Ativa:** `8b5e6597-3448-4ed7-ab08-6362a6ab4446`
  * **Domínio Público:** `https://pubcoreagencia-pubecomhub.contato-pubcore.workers.dev`
  * **Service Binding:** `env.CATALOG_WORKER` conectado ao `pub-ecom-catalog-worker`.
- **Catalog Worker (Core Catalog Service & D1):**
  * **Serviço Wrangler:** `pub-ecom-catalog-worker`
  * **Versão Ativa:** `ae7e2c5b-1ceb-4fae-869b-1313aa98177c`
  * **Domínio Público:** `https://pub-ecom-catalog-worker.contato-pubcore.workers.dev`
  * **Recursos Vinculados:** Cloudflare D1 (`pub-ecom-master-catalog`), Cloudflare Browser Rendering (`env.BROWSER`).

---

## 3. O que foi investigado e comprovado

1. **Causa Raiz do Erro 404 (Cloudflare Error 1042):**
   * Tentativas de fetch HTTP público do Hub Worker para o Catalog Worker dentro da mesma zona acionavam a proteção Cloudflare 1042.
   * **Solução:** Adicionado Service Binding `CATALOG_WORKER` no `wrangler.jsonc` do Hub, utilizando `env.CATALOG_WORKER.fetch(request)`.
2. **Classificação de Páginas & Interstitials no `BrowserWorker.ts`:**
   * Detecção de desafios do Mercado Livre (`/gz/account-verification`, "Para continuar, acesse sua conta", `negative_traffic`).
   * Classificação explícita: `PRODUCT_PAGE`, `ACCOUNT_VERIFICATION`, `CAPTCHA`, `ACCESS_DENIED`, `INTERSTITIAL`, `EMPTY`.
3. **Pipeline L3 Híbrido & Assisted Fallback:**
   * Se o Browser Run remoto encontra verificação de conta/WAF, o Catalog Worker emite `assistedRequired: true`.
   * O frontend entra no estado `ASSISTED_REQUIRED` e efetua a leitura assistida do DOM real, reenviando `clientCollectedData` para o backend.
4. **Validação Zero-Mock:**
   * O Catalog Worker valida o payload assistido (rejeitando `Produto Importado`, `49.90`, imagens `Unsplash`, dados vazios).
   * Payloads mockados são bloqueados com `HTTP 422`.
5. **Ciclo de Commit & Persistência D1:**
   * Primeira importação retorna `HTTP 201 Created` (`status: "IMPORTED"`).
   * Tentativa repetida retorna `HTTP 200 OK` (`status: "ALREADY_IMPORTED"`).
   * O produto é persistido e consultado com sucesso no D1 (`GET /v1/catalog/products`).

---

## 4. Arquivos Críticos

1. **Frontend / API Client:** [`src/lib/api/urlImport.ts`](file:///C:/Users/Matheus Paes/pubecomhub/src/lib/api/urlImport.ts)
2. **Frontend UI Page:** [`src/components/import/UrlProductImportPage.tsx`](file:///C:/Users/Matheus Paes/pubecomhub/src/components/import/UrlProductImportPage.tsx)
3. **Hub BFF Proxy:** [`src/server/catalogProxy.ts`](file:///C:/Users/Matheus Paes/pubecomhub/src/server/catalogProxy.ts)
4. **Catalog Worker Router:** [`catalog-worker/src/index.ts`](file:///C:/Users/Matheus Paes/pubecomhub/catalog-worker/src/index.ts)
5. **Browser Worker Engine:** [`pub-actors/pub-actors/packages/url-import-engine/src/workers/BrowserWorker.ts`](file:///C:/Users/Matheus Paes/pubecomhub/pub-actors/pub-actors/packages/url-import-engine/src/workers/BrowserWorker.ts)

---

## 5. O que NÃO deve ser refeito ou alterado

- **Não altere o Service Binding `CATALOG_WORKER`** no `wrangler.jsonc`.
- **Não crie métodos de fallback com dados sintéticos** (preços fixos ou imagens falsas).
- **Não altere a chamada de browser para `env.BROWSER.launch()`**; use `@cloudflare/puppeteer` com `puppeteer.launch(env.BROWSER)`.
- **Não exponha credenciais ou tokens** no Git.

---

## 6. Próximos Passos Recomendados

1. Implementar seletor interativo de variantes de produto na interface `UrlProductImportPage.tsx`.
2. Adicionar job em background para re-validação de estoque e preço de produtos salvos no D1.
3. Criar interface de sincronização entre D1 e canais externos (Shopify, WooCommerce, Nuvemshop).
