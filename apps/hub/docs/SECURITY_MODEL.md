# Modelo de Segurança e Controle de Acesso — PUB ECOM / PubecomHub

Este documento define formalmente a arquitetura de segurança, o controle de acesso baseado em papéis (RBAC), o isolamento multi-tenant, o inventário de policies RLS no PostgreSQL e os procedimentos de proteção contra vazamento de dados do **PubecomHub**.

---

## 1. Grafo de Relacionamentos e Ownership Real

A integridade do isolamento multi-tenant é garantida pelo grafo relacional no PostgreSQL:

```text
auth.users (id)
    ↑
profiles (id, role) [is_master() SECURITY DEFINER helper]
    ↑
    ├── stores (id, owner_id)
    │       ├── products (id, store_id, supplier_id, cost, profit_margin)
    │       │       └── [VIEW] public_store_products (exclui cost, profit_margin, supplier_id)
    │       ├── customers (id, store_id, name, email, phone)
    │       ├── marketing_events (id, store_id, customer_id)
    │       └── orders (id, store_id, customer_id, influencer_id, affiliate_id, cost, net_profit)
    │               └── [VIEW] influencer_orders (WHERE influencer_id/affiliate_id = auth.uid() OR is_master())
    │
    ├── suppliers (id, profile_id, name, category)
    │       ├── master_products (id, supplier_id, supplier_cost, base_price_pub)
    │       │       └── [VIEW] available_master_products (exclui supplier_cost / sanitiza metadata)
    │       └── [VIEW] public_suppliers (JOIN com master_products ativos / apenas authenticated)
    │
    ├── commissions (id, order_id, profile_id, amount)
    └── wallets (id, profile_id, balance)
            └── wallet_transactions (id, wallet_id, amount)
```

---

## 2. Inventário Completo das 11 Tabelas de Negócio e Políticas RLS (PostgreSQL)

| Tabela / View                            | RLS  | Comando                  | Role                  | Regra SQL (`USING` / `WITH CHECK`)                                                                    | Justificativa                                                                                 |
| :--------------------------------------- | :--- | :----------------------- | :-------------------- | :---------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------- |
| **`profiles`**                           | `ON` | `SELECT, UPDATE`         | `authenticated`       | `id = auth.uid() OR public.is_master()`                                                               | Usuário gerencia apenas seu próprio perfil; MASTER tem acesso global.                         |
| **`stores`**                             | `ON` | `SELECT`                 | `anon, authenticated` | `status = 'active' OR owner_id = auth.uid() OR public.is_master()`                                    | Visitantes veem lojas ativas; dono/MASTER veem todas as suas lojas.                           |
| **`stores`**                             | `ON` | `ALL`                    | `authenticated`       | `owner_id = auth.uid() OR public.is_master()`                                                         | Modificação restrita ao proprietário da loja e MASTER.                                        |
| **`suppliers`**                          | `ON` | `ALL`                    | `authenticated`       | `public.is_master() OR (profile_id = auth.uid())`                                                     | Tabela base restrita a MASTER e ao fornecedor dono.                                           |
| **`public_suppliers`** _(View)_          | -    | `SELECT`                 | `authenticated`       | `SELECT DISTINCT s.id, s.name, s.category, s.created_at FROM suppliers s JOIN master_products mp ...` | Catálogo comercial para usuários autenticados sem expor dados privados nem holding directory. |
| **`master_products`**                    | `ON` | `ALL`                    | `authenticated`       | `public.is_master() OR (suppliers.profile_id = auth.uid())`                                           | Tabela base contém `supplier_cost`. Restrita ao fornecedor proprietário e MASTER.             |
| **`available_master_products`** _(View)_ | -    | `SELECT`                 | `authenticated`       | Exclui `supplier_cost`. Sanitiza `metadata` JSONB.                                                    | Catálogo master comercial para Lojistas sem custos ou notas secretas de fornecedores.         |
| **`products`**                           | `ON` | `ALL`                    | `authenticated`       | `stores.owner_id = auth.uid() OR public.is_master()`                                                  | Tabela base contém `cost`, `profit_margin`. Restrita ao lojista dono da loja e MASTER.        |
| **`public_store_products`** _(View)_     | -    | `SELECT`                 | `anon, authenticated` | Projeção segura: `id, store_id, name, description, price, stock, image_url, status`                   | Vitrine da loja pública para visitantes e compradores sem expor margens ou custos.            |
| **`customers`**                          | `ON` | `SELECT, UPDATE, DELETE` | `authenticated`       | `stores.owner_id = auth.uid() OR (pedidos na loja) OR public.is_master()`                             | Dados pessoais de clientes visíveis somente pelo dono da respectiva loja.                     |
| **`customers`**                          | `ON` | `INSERT`                 | `authenticated`       | `stores.owner_id = auth.uid() OR public.is_master()`                                                  | Impede Cross-Tenant INSERT autenticado.                                                       |
| **`customers`**                          | `ON` | `INSERT`                 | `anon`                | `store_id IS NOT NULL AND stores.status = 'active'`                                                   | Checkout público de visitantes em lojas ativas.                                               |
| **`marketing_events`**                   | `ON` | `SELECT, UPDATE, DELETE` | `authenticated`       | `stores.owner_id = auth.uid() OR public.is_master()`                                                  | Eventos e rastreamento restritos ao dono da loja.                                             |
| **`marketing_events`**                   | `ON` | `INSERT`                 | `authenticated`       | `stores.owner_id = auth.uid() OR public.is_master()`                                                  | Impede inserções maliciosas cross-tenant.                                                     |
| **`marketing_events`**                   | `ON` | `INSERT`                 | `anon`                | `stores.status = 'active' AND check_customer_store_match(customer_id, store_id)`                      | Tracking de pixel com validação security definer entre cliente e loja.                        |
| **`orders`**                             | `ON` | `ALL`                    | `authenticated`       | `stores.owner_id = auth.uid() OR public.is_master()`                                                  | Tabela base com `cost`, `net_profit`, `financial_metadata` restrita ao dono da loja e MASTER. |
| **`influencer_orders`** _(View)_         | -    | `SELECT`                 | `authenticated`       | Predicado: `influencer_id = auth.uid() OR affiliate_id = auth.uid() OR is_master()`                   | Visão restrita no banco para influencers/afiliados sem expor custos ou margem da loja.        |
| **`commissions`**                        | `ON` | `ALL`                    | `authenticated`       | `profile_id = auth.uid() OR public.is_master()`                                                       | Beneficiário da comissão e MASTER.                                                            |
| **`wallets`**                            | `ON` | `ALL`                    | `authenticated`       | `profile_id = auth.uid() OR public.is_master()`                                                       | Titular da carteira e MASTER.                                                                 |
| **`wallet_transactions`**                | `ON` | `ALL`                    | `authenticated`       | `wallets.profile_id = auth.uid() OR public.is_master()`                                               | Titular da carteira e MASTER.                                                                 |

---

## 3. Matriz de Autorização Executada (PostgreSQL Real)

| Entidade                        | MASTER   | LOJISTA A       | LOJISTA B       | FORNECEDOR A      | FORNECEDOR B    | INFLUENCER A        | INFLUENCER B    | AFFILIATE A     | ANON                |
| :------------------------------ | :------- | :-------------- | :-------------- | :---------------- | :-------------- | :------------------ | :-------------- | :-------------- | :------------------ |
| **`profiles`**                  | `RW`     | `RW` (Self)     | `RW` (Self)     | `RW` (Self)       | `RW` (Self)     | `RW` (Self)         | `RW` (Self)     | `RW` (Self)     | `DENY`              |
| **`stores`**                    | `RW`     | `RW` (Store A)  | `RW` (Store B)  | `DENY` (modify)   | `DENY` (modify) | `DENY` (modify)     | `DENY` (modify) | `DENY` (modify) | `SELECT` (active)   |
| **`suppliers` (Base)**          | `RW`     | `DENY`          | `DENY`          | `RW` (Supplier A) | `DENY`          | `DENY`              | `DENY`          | `DENY`          | `DENY`              |
| **`public_suppliers`**          | `SELECT` | `SELECT`        | `SELECT`        | `SELECT`          | `SELECT`        | `SELECT`            | `SELECT`        | `SELECT`        | `DENY`              |
| **`master_products` (Base)**    | `RW`     | `DENY`          | `DENY`          | `RW` (Próprios)   | `DENY`          | `DENY`              | `DENY`          | `DENY`          | `DENY`              |
| **`available_master_products`** | `SELECT` | `SELECT`        | `SELECT`        | `SELECT`          | `SELECT`        | `SELECT`            | `SELECT`        | `SELECT`        | `DENY`              |
| **`products` (Base)**           | `RW`     | `RW` (Store A)  | `DENY`          | `DENY`            | `DENY`          | `DENY`              | `DENY`          | `DENY`          | `DENY`              |
| **`public_store_products`**     | `SELECT` | `SELECT`        | `SELECT`        | `SELECT`          | `SELECT`        | `SELECT`            | `SELECT`        | `SELECT`        | `SELECT` (vitrine)  |
| **`customers`**                 | `RW`     | `RW` (Store A)  | `DENY`          | `DENY`            | `DENY`          | `DENY`              | `DENY`          | `DENY`          | `INSERT` (checkout) |
| **`marketing_events`**          | `RW`     | `RW` (Store A)  | `DENY`          | `DENY`            | `DENY`          | `DENY`              | `DENY`          | `DENY`          | `INSERT` (pixel)    |
| **`orders` (Base)**             | `RW`     | `RW` (Store A)  | `DENY`          | `DENY`            | `DENY`          | `DENY`              | `DENY`          | `DENY`          | `DENY`              |
| **`influencer_orders`**         | `SELECT` | `DENY` (0 rows) | `DENY` (0 rows) | `DENY` (0 rows)   | `DENY` (0 rows) | `SELECT` (Próprios) | `DENY` (0 rows) | `DENY` (0 rows) | `DENY`              |
| **`commissions`**               | `RW`     | `DENY`          | `DENY`          | `DENY`            | `DENY`          | `RW` (Próprias)     | `DENY`          | `DENY`          | `DENY`              |
| **`wallets`**                   | `RW`     | `DENY`          | `DENY`          | `DENY`            | `DENY`          | `RW` (Própria)      | `DENY`          | `DENY`          | `DENY`              |
| **`wallet_transactions`**       | `RW`     | `DENY`          | `DENY`          | `DENY`            | `DENY`          | `RW` (Próprias)     | `DENY`          | `DENY`          | `DENY`              |

---

## 4. Auditoria de Segurança: Backend, Secrets e Client Bundle

1. **Proxy Server-Side (BFF):**
   - Rotas de catálogo intermediadas por `src/server/catalogProxy.ts` e `src/server.ts`.
   - O segredo `CATALOG_WORKER_TOKEN` reside exclusivamente em variáveis de ambiente server-side.
2. **Auditoria de `service_role`:**
   - `SUPABASE_SERVICE_ROLE_KEY` é carregada somente em `src/integrations/supabase/client.server.ts`.
   - Nenhum bundle do cliente importa `client.server.ts`.
3. **Auditoria do Client Bundle (`.output/public`):**
   - Verificação estática com regex de tokens sensíveis (`SUPABASE_SERVICE_ROLE_KEY`, `CATALOG_WORKER_TOKEN`, `service_role`).
   - Resultado: **0 ocorrências no bundle estático do cliente**.
