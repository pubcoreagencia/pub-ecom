# CHANGE CONTROL

Todas as modificações no estado funcional ou persistente da aplicação são regidas pelas políticas de governança a seguir:

## 1. Database Changes
Estão trancadas no nível "Foundation Frozen". Nenhuma nova migração, tabela, alteração de RLS, inserção de coluna ou criação de index deve ser efetuada sem **autorização arquitetural explícita** com a emissão do comando `Phase Change`.

## 2. Application Changes
Mutações na lógica TypeScript (`src/`) devem aderir aos seguintes crivos:
- **Respeitar schema:** O código deve consumir obrigatoriamente os tipos da `types/supabase.ts` e derivar dos DTOs corretos sem imaginar propriedades fantasma.
- **Respeitar arquitetura:** Novos `Repositories` herdam de `BaseRepository`. Novos `Services` herdam de `BaseService` contendo uma sub-rotina de `AuthorizationBoundary`.
- **Respeitar fase:** O implementador está cego para as fases futuras. Implemente estritamente o delimitado para seu Ticket/Escopo/Phase.

## 3. Dependency Changes
Qualquer nova instalação (`npm install`) só pode ocorrer sob total justificativa técnica irrefutável e escrutínio dos líderes. Priorize sempre a biblioteca padrão do Node ou as dependências já aprovadas no `package.json` primário (`@supabase/supabase-js`, `ws`, `tsx`, `typescript`).

## 4. Security Changes
A alteração de qualquer mecanismo de Autorização, verificação de JWT, Tenant Boundary, Logger e Identity exige impreterivelmente uma blindagem imediata com Testes (ex.: `tests/identity.test.ts` falhando na tentativa intencional de cross-tenancy).

## 5. Breaking Changes
Alterações no contrato das APIs do Repositório principal ou dos DTOs afetam todas as engrenagens futuras. Devem ser mapeadas via Relatório de Phase para homologação e os Mocks dos testes adjacentes devem ser modernizados logo em seguida.

## Regra Definitiva
**Quando houver dúvida sobre o estado do contrato, do modelo de negócios ou da infraestrutura:**
*DO NOT INVENT.* 
Pare a implementação. Emita um GAP log, repasse para decisão superior.
