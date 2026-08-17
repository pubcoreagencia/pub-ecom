# SECURITY MODEL

Este documento centraliza as políticas de segurança ativas no projeto. Nenhuma infraestrutura pode suplantar estas diretrizes.

## 1. Fluxos de Autorização Permitidos

### A. Navegação Pública
**Browser** 
↓
**Public Supabase Client** (`anon`) 
↓
**RLS**

### B. Navegação Autenticada (Padrão)
**Authenticated Server** (API Node, SSR Handlers)
↓
**Authenticated Supabase Client** (JWT do request embutido)
↓
**RLS**

### C. Ações Privilegiadas (Restrito)
**Privileged Server** (Webhooks Confiáveis, CronJobs)
↓
**Explicit Workflow** (Isolado da arquitetura front-end)
↓
**Privileged Client** (`service_role`)

## 2. Regras de Ouro
- **NUNCA:** Permita que requisições vindo do **browser** atinjam fluxos baseados em `service_role`.
- **NUNCA:** Utilize um ID de frontend (como `store_id` ou `organization_id`) como "Trusted Authorization" para permitir acesso. Toda posse deve ser validada cruzando com as identidades resolvidas no Backend (Ex: IdentityService -> Memberships).
- **NUNCA:** Logue senhas reais ou segredos em nenhuma de suas formas.

## 3. Prevenção de Leakage
A aplicação e os logs **nunca** devem expor sob nenhuma condição as seguintes informações sensíveis:
- Queries SQL.
- Stack traces (Call stacks crus).
- Detalhes internos do banco de dados (erros explícitos do PostgreSQL para o usuário).
- Access tokens (JWT).
- Refresh tokens.
- O token da `service_role`.
- API keys externas ou próprias.
- Webhook secrets.
- Payment credentials e Hashs PII sensíveis.

## 4. O Paradigma Fundamental
Todo o sistema foi erguido com a dupla validação do princípio de Defesa em Profundidade:

**Application Authorization** (A camada typescript de pré-validação com falha rápida e tipagem de Tenant Segura)
`+` (Somado a)
**Database RLS** (As Roles do PostgREST que forçam o Row Level Security impenetrável diretamente no cluster)
`=` 
**Defense in Depth**
