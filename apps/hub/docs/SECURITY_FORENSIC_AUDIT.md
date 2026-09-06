# Relatório de Auditoria Forense de Segurança — PUB ECOM / PubecomHub

Este documento detalha a investigação forense, a causa raiz arquitetural, a localização exata no código-fonte, a correção estrutural implementada e a prova objetiva de eliminação de cada um dos **10 findings do Lovable Security Scan** e da dependência auditada no repositório `pubcoreagencia/pubecomhub`.

---

## Matriz Forense Consolidada dos 10 Findings

### Finding 1 (CRITICAL)

**Finding:** _Any signed-in user can promote themselves to admin (MASTER) role_

- **Caminho / Arquivo Responsável:** `supabase/migrations/20260821133522_bd50e737-45a7-400c-b3e6-ee0865368a85.sql` e `supabase/migrations/20260822140000_final_rls_hardening.sql`.
- **Causa Raiz:** A policy de UPDATE em `public.profiles` permitia ao próprio usuário atualizar seu registro sem cláusula `WITH CHECK` restritiva de role, possibilitando a execução de `UPDATE profiles SET role = 'MASTER' WHERE id = auth.uid()`.
- **Correção Estrutural:**
  1. Criado trigger PostgreSQL `trg_prevent_role_escalation` (`BEFORE UPDATE ON public.profiles`) que intercepta alterações na coluna `role` e dispara exceção caso o chamador não possua privilégios `MASTER` (`IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_master() THEN RAISE EXCEPTION ...`).
  2. Criado trigger PostgreSQL `trg_enforce_profile_insert_role` (`BEFORE INSERT ON public.profiles`) que força `NEW.role := 'LOJISTA'` para cadastros realizados por usuários não-master.
  3. Atualizada a policy `Profiles update policy` com `WITH CHECK` restritivo: `(id = auth.uid() AND (role = (SELECT role FROM public.profiles WHERE id = auth.uid()) OR public.is_master())) OR public.is_master()`.
- **Prova / Testes:** `tests/real_postgres_rls.test.ts` (Seção 8: `LOJISTA attempting to promote self to MASTER is strictly DENIED by trigger/RLS`, `FORNECEDOR attempting to promote self to MASTER is strictly DENIED`, `INFLUENCER attempting to promote self to MASTER is strictly DENIED`, `MASTER is ALLOWED to change user roles`).

---

### Finding 2 (CRITICAL)

**Finding:** _Marketing event data can be read and modified by any authenticated user_

- **Caminho / Arquivo Responsável:** `supabase/migrations/20260821141909_799b9536-eddb-44c9-bbbb-a592c042077a.sql` e `supabase/migrations/20260822140000_final_rls_hardening.sql`.
- **Causa Raiz:** A migration inicial definia `CREATE POLICY "Authenticated users can manage marketing events" ON public.marketing_events FOR ALL TO authenticated USING (true);`.
- **Correção Estrutural:**
  1. Substituída a policy histórica por RLS multi-tenant estrito por `stores.owner_id = auth.uid()`.
  2. Modificação e exclusão restritas exclusivamente ao proprietário da loja e `MASTER`.
  3. Inserção anônima de tracking (pixel) protegida pela função SECURITY DEFINER `public.check_customer_store_match(customer_id, store_id)` exigindo que a loja esteja ativa e que o `customer_id` pertença à mesma loja.
- **Prova / Testes:** `tests/real_postgres_rls.test.ts` (Seção 5: `LOJISTA A reads only Store A marketing events`, `Cross-tenant INSERT by LOJISTA A into Store B is DENIED by PostgreSQL`, `ANON pixel tracking requires active store AND customer belonging to that same store`).

---

### Finding 3 (CRITICAL)

**Finding:** _Unauthenticated proxy lets anyone spend your paid catalog-scraping credits_

- **Caminho / Arquivo Responsável:** `src/server/catalogProxy.ts` e `src/server.ts`.
- **Causa Raiz:** O proxy `/ingestion/*` e `/v1/catalog/*` recebia requisições sem validar o JWT Supabase do chamador, injetando o `CATALOG_WORKER_TOKEN` e disparando operações de scraping no Cloudflare Worker.
- **Correção Estrutural:**
  1. Implementada a função `validateSupabaseCaller(request, envObj)` que extrai o Bearer token e valida `supabase.auth.getUser(token)`.
  2. Para operações de scraping/ingestão (`/ingestion/shopee`, `/ingestion/*`, `/api/ingestion/*`), exige `role === 'MASTER'`.
  3. Para `/v1/catalog/stores/:storeId/refresh`, exige `MASTER` ou propriedade comprovada da loja para `LOJISTA` (`stores.owner_id === auth.userId`).
  4. Requisições anônimas retornam `401 Unauthorized` e lojistas não autorizados retornam `403 Forbidden`.
- **Prova / Testes:** `tests/catalog_proxy_auth.test.ts` (11 testes HTTP reais cobrindo todos os cenários de role e tenant).

---

### Finding 4 (CRITICAL)

**Finding:** _All customer contact information exposed to any logged-in user_

- **Caminho / Arquivo Responsável:** `supabase/migrations/20260821133522_bd50e737-45a7-400c-b3e6-ee0865368a85.sql` e `supabase/migrations/20260822140000_final_rls_hardening.sql`.
- **Causa Raiz:** A migration inicial continha `CREATE POLICY "Authenticated users can view customers" ON public.customers FOR SELECT TO authenticated USING (true);`.
- **Correção Estrutural:**
  1. Tabela `customers` restrita a `stores.owner_id = auth.uid()` e `MASTER`.
  2. Inserção cross-tenant autenticada bloqueada pelo PostgreSQL.
  3. Inserção anônima permitida exclusivamente no fluxo de checkout para lojas com `status = 'active'`.
- **Prova / Testes:** `tests/real_postgres_rls.test.ts` (Seção 4: `LOJISTA A reads only Store A customers, getting 0 rows for Store B`, `Cross-tenant INSERT by authenticated LOJISTA A into Store B is DENIED by PostgreSQL`).

---

### Finding 5 (WARNING)

**Finding:** _Product cost and profit margin data publicly exposed_

- **Caminho / Arquivo Responsável:** `supabase/migrations/20260821133522_bd50e737-45a7-400c-b3e6-ee0865368a85.sql`, `src/lib/repositories/productRepository.ts` e `supabase/migrations/20260822140000_final_rls_hardening.sql`.
- **Causa Raiz:** A migration inicial continha `CREATE POLICY "Public can view products" ON public.products FOR SELECT TO anon, authenticated USING (true);`.
- **Correção Estrutural:**
  1. Tabela base `products` restrita a `stores.owner_id = auth.uid()` e `MASTER`.
  2. Criada a view pública segura `public.public_store_products` (`WITH (security_invoker = false)`) que projeta unicamente `id, store_id, name, description, price, stock, image_url, status`, omitindo 100% dos dados de custo e margem.
  3. Vitrine consome exclusivamente `public_store_products`.
- **Prova / Testes:** `tests/real_postgres_rls.test.ts` (Seção 3: `ANON gets 0 rows on base products table (DENY)`, `public_store_products view strictly excludes cost, profit_margin, and supplier_id`).

---

### Finding 6 (WARNING)

**Finding:** _Catalog scraper can be aimed at arbitrary internal/external URLs (SSRF)_

- **Caminho / Arquivo Responsável:** `src/lib/ingestion/security/urlValidator.ts`, `src/lib/catalog.functions.ts`, `src/lib/ingestion/SourceResolver.ts`, `src/lib/ingestion/adapters/ShopeeAdapter.ts`.
- **Causa Raiz:** O scraper aceitava URLs arbitrárias passadas como parâmetro sem validação estrita de hostname, protocolo e faixas de IP privadas/internas.
- **Correção Estrutural:**
  1. Criado módulo central `src/lib/ingestion/security/urlValidator.ts` com as funções `isAllowedTargetUrl(url)` e `validateTargetUrl(url)`.
  2. Bloqueio determinístico de `localhost`, `127.0.0.1`, `0.0.0.0`, `::1`, link-local (`169.254.169.254`), faixas privadas RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) e protocolos não-HTTP (`file:`, `javascript:`, `ftp:`, `data:`).
  3. Whitelist estrita de domínios permitidos (`shopee.com.br`, subdomínios Shopee e `pubcore.com.br`).
  4. Validação executada em `analyzeCatalogFn`, `SourceResolver`, `ShopeeAdapter` e `ShopeeWorker`.
- **Prova / Testes:** `tests/ssrf_validator.test.ts` (12 testes cobrindo todos os vetores de ataque SSRF).

---

### Finding 7 (WARNING)

**Finding:** _Master product catalog including supplier cost visible to all authenticated users_

- **Caminho / Arquivo Responsável:** `supabase/migrations/20260821141909_799b9536-eddb-44c9-bbbb-a592c042077a.sql` e `supabase/migrations/20260822140000_final_rls_hardening.sql`.
- **Causa Raiz:** A migration inicial continha `CREATE POLICY "Master products are viewable by all authenticated users" ON public.master_products FOR SELECT TO authenticated USING (true);`.
- **Correção Estrutural:**
  1. Tabela base `master_products` restrita a `MASTER` e ao fornecedor proprietário (`suppliers.profile_id = auth.uid()`).
  2. Criada a view comercial `public.available_master_products` que omite `supplier_cost` e aplica sanitização estrita no JSONB via `jsonb_build_object('external_id', ..., 'brand', ..., 'attributes', ...)`.
- **Prova / Testes:** `tests/real_postgres_rls.test.ts` (Seção 2: `LOJISTA gets 0 rows on base master_products table`, `available_master_products view omits supplier_cost`).

---

### Finding 8 (WARNING)

**Finding:** _Supplier directory fully visible to any authenticated account_

- **Caminho / Arquivo Responsável:** `supabase/migrations/20260821133522_bd50e737-45a7-400c-b3e6-ee0865368a85.sql` e `supabase/migrations/20260822140000_final_rls_hardening.sql`.
- **Causa Raiz:** A migration inicial continha `CREATE POLICY "Authenticated users can view suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);`.
- **Correção Estrutural:**
  1. Tabela base `suppliers` restrita a `MASTER` e ao fornecedor dono (`profile_id = auth.uid()`).
  2. View `public.public_suppliers` restrita a `authenticated` com filtro estrito `JOIN master_products mp WHERE mp.is_available = true AND mp.status = 'active'`, impedindo a enumeração do diretório institucional da holding.
- **Prova / Testes:** `tests/real_postgres_rls.test.ts` (Seção 1: `LOJISTA gets 0 rows from base suppliers table (DENY)`).

---

### Finding 9 (WARNING)

**Finding:** _Order and catalog-import server functions never verify who is calling_

- **Caminho / Arquivo Responsável:** `src/lib/catalog.functions.ts`, `src/lib/order.functions.ts` e `src/lib/worker-factory.functions.ts`.
- **Causa Raiz:** As server functions criadas com `createServerFn` não possuíam middleware de autenticação e não realizavam checagem de autorização no backend.
- **Correção Estrutural:**
  1. Todas as server functions foram equipadas com `.middleware([requireSupabaseAuth])`.
  2. `analyzeCatalogFn`: validação de role `MASTER` ou `FORNECEDOR` e validação SSRF da URL.
  3. `importProductsFn`: validação de role `MASTER` ou propriedade do `supplierId`.
  4. `createOrderFn`: validação de propriedade da loja ou `MASTER`.
  5. `getOrdersFn`: validação estrita por loja, influencer ou `MASTER`.
  6. `createCatalogWorkerFn`: restrição estrita a `MASTER`.
- **Prova / Testes:** `tests/real_postgres_rls.test.ts` e `tests/catalog_proxy_auth.test.ts`.

---

### Finding 10 (WARNING)

**Finding:** _Service-role Supabase client imported at module top-level in bundled route files_

- **Caminho / Arquivo Responsável:** `src/routes/api/catalog/stores/$storeId.refresh.ts`, `src/routes/api/ingestion/shopee.ts`, `src/lib/ingestion/security/authorization.server.ts`.
- **Causa Raiz:** Arquivos de rota do TanStack Router (`src/routes/**`) continham a declaração top-level `import { supabaseAdmin } from '@/integrations/supabase/client.server'`, fazendo com que o analisador estático do bundler detectasse referências ao client service_role em arquivos de rotas roteadas.
- **Correção Estrutural:**
  1. Removidos todos os imports top-level de `client.server` de todos os arquivos em `src/routes/**`.
  2. Rotas de API delegam para o proxy central `handleCatalogProxy(request, env)`.
  3. Onde o client service_role for indispensável no servidor, utiliza-se import dinâmico em tempo de execução (`await import("@/integrations/supabase/client.server")`) dentro da função handler.
- **Prova / Testes:** Auditoria estática de código (`0` imports top-level em `src/routes/**`), typecheck (`PASS`) e auditoria de bundle `.output/public` (`0` ocorrências de secrets).

---

### Dependência Auditada

**Item:** _53 packages • 1 known vulnerability_

- **Investigação:** Auditadas as 53 dependências diretas listadas no `package.json`.
- **Status do npm audit:** `npm audit --json` reporta **0 vulnerabilidades** no grafo de dependências atual com `@tanstack/react-start: 1.168.48`.

---

## Validação e Verificação Completa

```text
 ✓ tests/ssrf_validator.test.ts (12 tests) 9ms
 ✓ catalog-worker/src/index.test.ts (4 tests) 30ms
 ✓ tests/security_authorization.test.ts (6 tests) 26ms
 ✓ tests/catalog_proxy_auth.test.ts (11 tests) 47ms
 ✓ tests/real_postgres_rls.test.ts (36 tests) 1756ms

 Test Files  5 passed (5)
      Tests  69 passed (69)
   Duration  2.09s
```

- **Typecheck (`npx tsc --noEmit`):** `PASS` (0 erros).
- **Produção Build (`npm run build`):** `PASS` (0 erros).
- **Auditoria de Secrets no Client Bundle (`.output/public`):** **0 ocorrências** de `SUPABASE_SERVICE_ROLE_KEY`, `CATALOG_WORKER_TOKEN`, `service_role` ou `supabaseAdmin`.
