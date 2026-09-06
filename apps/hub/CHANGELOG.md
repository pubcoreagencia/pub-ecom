# Changelog - PUB ECOM HUB

## [1.9.0] - 2026-08-25

### Adicionado

- **Estratégia L3 Híbrida de Ingestão de Catálogo**:
  - Implementação de cascata resiliente `L1 HTTP` -> `L2 API` -> `L3 Browser Run (@cloudflare/puppeteer)` -> `Assisted Fallback`.
  - Classificação explícita de páginas (`PRODUCT_PAGE`, `ACCOUNT_VERIFICATION`, `CAPTCHA`, `ACCESS_DENIED`, `INTERSTITIAL`, `EMPTY`) em `BrowserWorker.ts`.
  - Detecção avançada de desafios e interstitials do Mercado Livre (`/gz/account-verification`, `negative_traffic`).
  - Suporte ao estado `ASSISTED_REQUIRED` na UI (`UrlProductImportPage.tsx`) com leitura assistida e transparente no navegador do lojista.
  - Defesa estrita **Zero-Mock** no Catalog Worker com rejeição de dados sintéticos (`Produto Importado`, valores `49.90`, imagens `Unsplash`).
  - Ciclo de vida completo do commit no D1: `HTTP 201 Created` (`status: "IMPORTED"`) e idempotência `HTTP 200 OK` (`status: "ALREADY_IMPORTED"`).

### Corrigido

- **Cloudflare Error 1042 / HTTP 404**: Substituído o salto HTTP público entre Hub e Catalog Worker por **Cloudflare Service Binding** nativo (`CATALOG_WORKER`), eliminando erros de roteamento de mesma zona.
- **Compatibilidade Cloudflare Puppeteer**: Atualizado `BrowserWorker` para instanciar via `puppeteer.launch(env.BROWSER)` oficial.
- **Roteamento de Autenticação**: Permitido acesso a `/v1/catalog/import/*` e `/v1/catalog/products` via Service Binding e requisições públicas autorizadas.

## [1.8.0] - 2026-08-23

### Adicionado

- **Segurança Master**: Implementada funcionalidade de alteração de senha definitiva para a conta MASTER diretamente via interface de configurações.
- **Server Functions**: Criada `updateMasterPassword` utilizando `supabaseAdmin` para garantir o reset mesmo sob restrições de política do GoTrue.

### Alterado

- **Dashboard Settings**: Nova seção de "Segurança" adicionada à `SettingsPage.tsx` com formulário de alteração de senha e feedback visual via `sonner`.
- **Migração Supabase**: Removidas restrições de ID de projeto hardcoded em `LoginPage.tsx`, `catalog.ts` e `supabase/client.ts`.

## [1.7.4] - 2026-08-23

### Corrigido

- **Ingestion Engine**: Adicionada proteção SSRF pre-flight no endpoint `/api/ingestion/shopee` e logs de diagnóstico para ausência de `CATALOG_WORKER_TOKEN`.

## [1.7.2] - 2026-08-22

### Segurança

- **Correção de 10 findings de segurança selecionados**:
  - **Escalonamento de papel (profiles)**: Triggers `prevent_role_escalation` e `enforce_profile_insert_role` + helper `is_master()` impedem que usuários comuns se promovam a MASTER.
  - **RLS endurecido**: Policies permissivas removidas de `customers`, `marketing_events`, `master_products`, `products` e `suppliers`; acesso agora restrito a MASTER, donos de loja/fornecedor e relacionamentos via pedidos.
  - **Views seguras**: `public_store_products`, `available_master_products` e `public_suppliers` expõem apenas colunas seguras para browsing público/autenticado.
  - **SSRF no Catalog Worker**: Validação estrita de hostname (allow-list Shopee) no `ShopeeAdapter` e dentro do worker antes de qualquer navegação do browser headless.
  - **Verificado**: Proxy de catálogo autenticado via JWT, server functions com `requireSupabaseAuth`, e rotas de API sem import privilegiado em top-level.
  - Suite de testes de segurança: 69/69 passando.

## [1.7.1] - 2026-08-22

### Segurança

- **Correção de Vulnerabilidade CVE-2026-59870**: Atualizado `@tanstack/react-start` de `1.168.32` para `1.168.48` e dependências relacionadas (`react-router`, `router-plugin`) para mitigar vulnerabilidade de DoS no `js-yaml`.
- **Lockfile**: Gerado `bun.lock` em formato texto para melhor auditabilidade de segurança.

## [1.7.0] - 2026-08-22

### Adicionado

- **Melhoria UX de Diagnóstico**: Adicionada exibição literal das variáveis de ambiente necessárias (`VITE_CATALOG_API_URL`, `VITE_CATALOG_API_TOKEN`) no toast de erro 401 da `CatalogIngestion`.
- **Fase 2G - Resolução de CORS e Preflight**:
  - Implementação de camada CORS centralizada no `catalog-worker` (`cors.ts`).
  - Suporte a requisições `OPTIONS` (Preflight) retornando status 204.
  - Headers `Access-Control-Allow-Origin` configurados para `localhost`, Cloudflare Workers/Pages e domínio de produção.
  - Garantia de headers CORS em todas as respostas (401 Unauthorized, 404 Not Found, etc).
  - Suporte explícito aos headers `Authorization` e `Content-Type`.
  - Suite de testes unitários para validação de fluxos CORS.

## [1.6.5] - 2026-08-21

### Adicionado

- **Fase 2F.9 - Diagnóstico de Limites do Cloudflare Browser Run**:
  - Implementação do endpoint `GET /debug/browser` no `catalog-worker` para expor `playwright.limits()`, `sessions()` e `history()`.
  - Proteção do endpoint de debug via `CATALOG_WORKER_TOKEN`.
  - Atualização da interface principal (`/`) com o dashboard de diagnóstico de HTTP 429.
  - Validação de build e empacotamento (`esbuild`) com sucesso no worker.

## [1.6.4] - 2026-08-21

### Adicionado

- **Fase 2F.4 - Health Check do PUB ECOM Catalog Worker**:
  - Formalização do endpoint `/health` público (sem token) para monitoramento.
  - Validação técnica completa em `catalog-worker/`: `npm install`, `npm run typecheck`, `npm run build` e `wrangler deploy --dry-run`.
  - Atualização da página inicial `/` refletindo o novo status da infraestrutura.

...

## [1.7.3] - 2026-08-23

### Segurança

- **Hardening Final (RLS & SQL Functions)**:
  - Revogada permissão de execução (`EXECUTE`) das funções `is_master()`, `has_role()` e `prevent_role_escalation()` para `PUBLIC` e `authenticated`, restringindo ao `service_role` e `postgres`.
  - Configurado `security_invoker = true` nas views `available_master_products`, `public_store_products` e `public_suppliers`, garantindo conformidade com PostgreSQL 15+ e aplicação correta de RLS em sub-consultas.
  - Endurecida política de `UPDATE` na tabela `profiles` com cláusula `WITH CHECK` para impedir alteração de `role` mesmo se o trigger falhar.
- **SSRF Protection**: Auditado `urlValidator.ts` e `catalogProxy.ts` confirmando validação de domínio e bloqueio de IPs privados em operações de backend.
- **Autorização TanStack**: Validado `DashboardGuard` para acesso exclusivo `MASTER` e `catalogProxy` com autorização multi-nível (MASTER global, LOJISTA proprietário).

### UI/UX

- **Auth**: Atualizados placeholders e labels de login para refletir o usuário master oficial `contato.pubcore@gmail.com`.
- **Docs**: Atualizado `PROJECT_CONTEXT.md` com o baseline de segurança validado e credenciais oficiais.
