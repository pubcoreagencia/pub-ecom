# DATABASE CONTRACT

O banco de dados atual encontra-se provisionado e **congelado** em seu estado original da Fase 1.1. 

## 1. Migrations Exists
O schema é construído unicamente sob a fundação das seguintes migrations:
- `00001_core_and_enums.sql`
- `00002_identity.sql`
- `00003_catalog_inventory.sql`
- `00004_commerce.sql`
- `00005_orders_shipping.sql`
- `00006_finance_audit.sql`
- `00007_rpc_rls_security.sql`

## 2. Tabelas & Grupos de Domínio

### Identity & Tenancy
- `users`: id, email, full_name, created_at, updated_at
- `organizations`: id, name, document, status, created_at, updated_at
- `memberships`: id, user_id, organization_id, role, created_at

### Catalog & Inventory
- `suppliers`: id, name, document, contact_email
- `master_products`: id, base_sku, name, description, supplier_id, status
- `master_product_variants`: id, master_product_id, sku, cost_price, weight_grams
- `master_inventory`: id, master_variant_id, on_hand, reserved, committed

### Commerce (Commercial Offering)
- `stores`: id, organization_id, name, slug, status
- `store_domains`: id, store_id, domain, is_primary, ssl_status
- `store_products`: id, store_id, master_product_id, title, slug, status, seo_data
- `store_product_variants`: id, store_product_id, master_variant_id, sale_price, compare_at_price, is_active
- `customers`: id, user_id, organization_id, email, document, full_name

### Orders & Shipping
- `carts`: id, customer_id, store_id, session_id, status
- `cart_items`: id, cart_id, store_variant_id, quantity, unit_price
- `orders`: id, store_id, customer_id, status, total_amount
- `order_items`: id, order_id, store_variant_id, quantity, unit_price, cost_price
- `shipping_snapshots`: id, order_id, method, tracking_code, snapshot_data
- `inventory_movements`: id, master_variant_id, type, quantity, reference_id, reference_type

### Finance & Audit
- `financial_transactions`: id, organization_id, type, amount, status, reference_id
- `audit_logs`: id, table_name, record_id, action, old_data, new_data, performed_by

## 3. Database Roles vs Application Roles

**Database Roles (Postgres):**
- `anon`: Usuários não autenticados via Supabase.
- `authenticated`: Usuários que validaram login via Supabase JWT.
- `service_role`: Privilégio máximo de bypass do Supabase (Apenas Servidor interno).

**Application Roles (Memberships):**
- Derivados de `memberships.role`. Representam os papéis comerciais que o User exerce perante a sua Organização (Ex: 'OWNER', 'MANAGER', 'STAFF').

*Nota Importante:* Não se deve confundir a Role no RLS com o Papel (Role) na Membership da Organização.

## 4. RPCs & Functions Existentes
*O contrato RLS dita que as seguintes funções estão habilitadas (como visto na Fase 1.1):*
- `check_membership()`
- Funções de state machine do inventário
*(Qualquer outra função que não esteja nas migrations 00001-00007 é inexistente e inoperante).*

## 5. Principais Relacionamentos (Hierarquia)
- User ↔ Memberships ↔ Organizations
- Organizations ↔ Stores ↔ Store Domains
- User ↔ Customers ↔ Organizations
- Master Products ↔ Master Variants ↔ Master Inventory
- Stores ↔ Store Products (aponta para Master Products) ↔ Store Variants (aponta para Master Variants)

## 6. Generated Types
O repositório utiliza o `types/supabase.ts` como tipagem **Canônica**. Nenhuma interface em `src/` pode assumir campos extras sem usar os utilitários de Join/Type mapping oriundos desse arquivo-fonte.
