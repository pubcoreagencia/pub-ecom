# ARCHITECTURE MAP

O fluxo de dados da aplicação obedece a um esquema estrito de camadas, onde a UI nunca conversa com o banco sob privilégios irrestritos e as barreiras são fortemente demarcadas.

## 1. Top-to-Bottom Flow

**Browser / Public Client**
↓
**Application Layer** (NextJS/Node SSR / Handlers / Services)
↓
**Supabase Client** (Authenticated via JWT do usuário)
↓
**PostgreSQL** / RLS / RPC
↓
**External Providers** / Webhooks (Somente via Server Layer)
↓
**Persistence**

## 2. Estrutura do Código-Fonte (`src/`)

A base estrutural está segregada para escalabilidade do monolito:
- `config/`: Variáveis de ambiente isoladas entre server-side e client-side.
- `lib/`: Classes base, context providers (AuthContext, TenantContext), Boundary Definitions, AppErrors e o StructuredLogger.
- `repositories/`: Classes de abstração para consultas ao DB. Não contêm lógicas HTTP. Extensões de `BaseRepository`.
- `services/`: Classes de validação, mapeamento (DTOs) e junção de sub-domínios. Enforçam o limite de autorização antes de requisitar o repositório. Extensões de `BaseService`.
- `types/`: O espelho das definições do Supabase para TypeScript estrito.

## 3. Fluxo de Domínios
O desenvolvimento e a hierarquia obedecem rigorosamente à fundação a seguir:

`AUTH` (Autenticação JWT / Supabase Auth)
↓
`TENANCY` (Organizações, Memberships e Contexto Isolado)
↓
`CATALOG` (Produtos Mestres, SKUs Base e Inventário Real)
↓
`COMMERCIAL OFFERING` (Precificação local, Catálogo de Loja)
↓
*`CUSTOMER`* (Lógica final e carteira de consumidores) -- *[A implementar]*
↓
*`CART`* -- *[A implementar]*
↓
*`CHECKOUT`* -- *[A implementar]*
↓
*`ORDER`* -- *[A implementar]*
↓
*`SHIPPING`* -- *[A implementar]*
↓
*`PAYMENT`* -- *[A implementar]*
↓
*`FINANCE`* -- *[A implementar]*
↓
*`ANALYTICS`* -- *[A implementar]*

*(Os domínios assinalados como [A implementar] não possuem infraestrutura de código criada, servindo apenas como roadmaps. Não tente ativá-los antes da fase correta.)*
