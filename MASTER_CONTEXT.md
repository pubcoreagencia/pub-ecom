# MASTER CONTEXT

## Identidade do PUB ECOM
A PUB ECOM não atua como um provedor passivo de infraestrutura de SaaS, mas como o **Operador Central** e dono de um ecossistema comercial end-to-end.

## Business Model
O fluxo de distribuição comercial obedece a hierarquia:
*   **PUB ECOM = CENTRAL OPERATOR**: Controla fornecedores, catálogo mestre (`master_products`), tecnologia, logística e finanças operacionais.
*   **MENTOR = COMMERCIAL REPRESENTATIVE**: Recebe um ambiente de loja (store) via alocação em uma organização. Não opera estoques ou cataloga produtos originais; ele distribui as instâncias fornecidas pela plataforma.
*   **STORE = COMMERCIAL DISTRIBUTION SURFACE**: O front end de vendas, detentor das listagens comerciais (`store_products`) e precificação.
*   **CUSTOMER = END CUSTOMER**: O cliente final compra no ambiente da `store`.

*Importante:*
`MASTER CATALOG` ≠ `COMMERCIAL OFFERING` ≠ `STORE`
O Catálogo mestre é único. A oferta comercial (Store Product) é a vitrine que reflete o Mestre em uma Loja específica.

## Application Architecture & Multi-Tenancy
A arquitetura se fundamenta na passagem de um contexto rigoroso a cada requisição:
- Identidade (Users/Sessions via Supabase Auth)
- Tenant (Membership -> Organization -> Store)
- Catálogo (Store Products derivados de Master Products)

## Database Foundation & Security Principles
O banco de dados é congelado, gerido através das migrations 00001 a 00007.
A segurança é garantida via "Defense in Depth":
Application Authorization (pre-checks no Typescript) + Database RLS (Row Level Security real enforced via PostgREST).

## Future Evolution
O futuro pode englobar um modelo onde MENTORADO opera de forma totalmente SELF-SERVICE ou detém infraestrutura separada, entretanto, **isto não existe na atual fundação**.

## Current Architectural Position
As bases (Identidade, Tenant, e Catalog) foram erguidas e enrijecidas no backend.
A UI, Cart, Order, e Payments ainda não existem neste snapshot.
