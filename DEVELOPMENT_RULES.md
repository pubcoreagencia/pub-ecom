# DEVELOPMENT RULES

As regras de engenharia deste projeto são dogmáticas e imutáveis. Desrespeitar qualquer uma das regras acarreta em falha da arquitetura.

## 1. DATABASE FROZEN
O schema atual (`supabase/migrations/`) está finalizado para o contexto corrente. Modificações na base são terminantemente proibidas durante as implementações de fase no core (Phase 3+).

## 2. REAL SCHEMA ONLY
Não utilize a imaginação. Não assuma que uma tabela ou campo existe apenas porque o domínio costuma tê-lo. Todo repositório ou serviço em `src/` deve estender seus generics unicamente da assinatura exportada em `types/supabase.ts`.

## 3. NO DUPLICATE INFRASTRUCTURE
A fundação já possui BaseService, BaseRepository, StructuredLogger, TenantContext, e AppError. Reutilize. Não crie um novo `Error.ts`, um novo tratador de requests, nem um novo Logger.

## 4. NO SPECULATIVE FEATURES
Se uma regra de negócio ou lógica não está contemplada nas diretrizes documentadas e não tem contraparte no banco de dados real (ex.: um campo de comissão ou webhook), não implemente.

## 5. NO PHASE BLEEDING
Ao receber o mandato para implementar um módulo "A", nunca tente implementar sub-rotinas do módulo "B".

## 6. RLS FINAL AUTHORIZATION
As premissas de segurança executadas na camada da aplicação (pre-checks) servem apenas para "fail-fast" e tipagem segura (boundary pass). A autorização absoluta reside no Row Level Security do PostgreSQL. A aplicação NÃO suplanta o RLS.

## 7. SERVICE_ROLE SERVER ONLY
O client instanciado através da Supabase Admin Key não deve ser repassado ao `TenantContext` ordinário e não viaja para o frontend. Seu uso só deve ocorrer em Webhooks protegidos ou tarefas de background isoladas.

## 8. TEST BEFORE COMPLETE
Nenhuma Phase pode ser carimbada como `COMPLETE` sem provas concretas e rastreáveis na camada de testes unindo o repositório/service aos mocks corretos que imitem as rejeições do Supabase.

## 9. NO AUTOMATIC COMMIT
As mudanças arquiteturais e codificações em cada fase não devem ser commitadas no Git até ordem explícita da chefia técnica/owner. Sempre encerre fornecendo Diff e Stat para validação humana/superior.

## 10. DOCUMENT GAPS
Quando a instrução pede X, mas o banco provê apenas Y, e para fazer X é impossível sem alterar o banco: registre o GAP e aborte a implementação específica.

## Workflow Universal
Sempre, impreterivelmente siga:
`INSPECT` -> `COMPARE` -> `REUSE` -> `IMPLEMENT`
