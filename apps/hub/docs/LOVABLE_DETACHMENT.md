# PUB ECOM — Lovable Detachment

This branch removes the application runtime dependency on Lovable while preserving the existing PUB ECOM codebase.

## Target architecture

- Frontend/runtime: TanStack Start + Vite
- Hosting target: Cloudflare Workers
- Authentication/data: official Supabase project `vtcnundfslqqlxdyrogv`
- Catalog Hub: existing Cloudflare Worker integration
- Shopee ingestion: existing catalog worker + scraper pipeline

## Removed

- Lovable Vite configuration package
- Lovable preview auth broker
- `.lovable` project metadata
- committed local `.env`

## Validation required before merge

1. Regenerate `package-lock.json` after dependency changes.
2. Run `npm install` (or the repository's chosen package manager) to synchronize lockfiles.
3. Run `npm run build`.
4. Run `npm run lint`.
5. Run the existing Vitest/E2E suites.
6. Run `wrangler check` and `wrangler deploy --dry-run`.
7. Validate Supabase JWT issuer is `https://vtcnundfslqqlxdyrogv.supabase.co/auth/v1`.
8. Validate the production Hub accepts the resulting JWT.
9. Only after all checks pass, deploy the standalone PUB ECOM Worker and merge to `main`.
