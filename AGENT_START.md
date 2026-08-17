# AGENT START

Welcome to the PUB ECOM project. Before taking any action, writing code, or running commands, **YOU MUST** read the following documentation files in order:

1. [MASTER_CONTEXT.md](MASTER_CONTEXT.md)
2. [BUSINESS_MODEL.md](BUSINESS_MODEL.md)
3. [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md)
4. [DATABASE_CONTRACT.md](DATABASE_CONTRACT.md)
5. [PHASE_STATUS.md](PHASE_STATUS.md)
6. [ARCHITECTURE_MAP.md](ARCHITECTURE_MAP.md)
7. [SECURITY_MODEL.md](SECURITY_MODEL.md)

## INITIAL PROCEDURES
- Execute `git status`
- Execute `git log --oneline -5`
- Inspecione as estruturas em `src/`, `tests/` e `supabase/migrations/` antes de codificar.

## MANDATORY RULES

- **DATABASE FOUNDATION = FROZEN**: Não altere as migrations, o schema, nem crie novas tabelas ou funções.
- **REAL SCHEMA ONLY**: Confie apenas nas colunas e relacionamentos expressos em `types/supabase.ts`.
- **RLS = FINAL ENFORCEMENT**: Application authorization atua apenas como pre-check.
- **SERVICE_ROLE = SERVER ONLY**: O cliente privilegiado (`admin.ts`) nunca deve vazar para a UI ou workflows genéricos.
- **NO PHASE BLEEDING**: Só implemente o escopo exato exigido na fase atual.
- **NO INVENTED DATABASE CAPABILITIES**: Não pressuponha cronjobs, triggers, ou listeners que não existam nas migrations de 00001 a 00007.

Quando houver GAP:
**STOP. DOCUMENT. DO NOT INVENT.**
