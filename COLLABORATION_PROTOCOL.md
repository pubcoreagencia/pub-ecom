# COLLABORATION PROTOCOL

O ecossistema atua com agentes e desenvolvedores operando no mesmo monolito simultaneamente e em momentos de tempo distintos. As falhas de comunicação devem ser zero.

## 1. Primeiros Passos Antes de Codificar
Toda nova sessão ou chamado deve impreterivelmente transitar pelos seguintes pilares:
1. Ler todo o contexto e documentação base atual.
2. Verificar o status e a árvore atual via `git status` e `git log --oneline -5`.
3. Inspecionar o código existente visualmente (`find`, leituras no `src/`).
4. Verificar se o contrato do banco e as migrations suportam o mandato da fase atual.

## 2. Regras Comportamentais
- **Não assumir arquivos:** Não adivinhe a existência de um utilitário. Procure-o na codebase.
- **Não assumir mudanças:** Valide sempre o `package.json` para test hooks.
- **Não modificar shared infrastructure silenciosamente:** Se você precisa alterar o `AppError` ou o `BaseService` base, isso deve ser tratado na Governance, e o PR deve deixar isso claro no título e nos logs. Silenciar uma quebra de refactor prejudicará outro agente.
- **Não modificar banco:** As migrations são a fonte da verdade e estritas à equipe de DB.
- **Targeted tests obrigatórios:** Não aprove a própria fase através de inferências. Só a declare conclusa quando testes diretos (`npm test`) disserem "PASSED".

## 3. Obrigatoriedade de Report (Reporting)
Qualquer transição de Fase ou finalização de Escopo exige um output text formal. Neste output conste inequivocamente:
- A lista de arquivos recém-adicionados.
- A lista detalhada de arquivos modificados.
- A lista exata de dependências introduzidas. (Idealmente `NONE`).
- O estado de Database Changes (Idealmente `NONE`).
- Quaisquer Gaps detectados entre o mandato da fase e a realidade estrutural.
