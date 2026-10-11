# Repository Guidelines

PasujeMi is a Polish-language recipe-matching web app built on the 10x Astro Starter: Astro 7 SSR with React 19 islands, TypeScript, Tailwind 4 and Supabase (auth + Postgres), deployed to Cloudflare Workers. Product scope lives in @context/foundation/prd.md.

## Hard Rules

- Never write to `context/archive/`; archived changes are immutable. `context/foundation/` (PRD, tech-stack hand-off) is the source of truth — do not rewrite it as a side effect.
- Enable RLS on every new Supabase table with per-operation, per-role policies. Pantry staples and exclusions are private; only a recipe's author or an admin may edit it.
- Read `SUPABASE_URL` / `SUPABASE_KEY` only via `astro:env/server` (schema in @astro.config.mjs); never pass them to client components. Local secrets go in `.env` and `.dev.vars` (gitignored).

## Commands

- `npm run dev` — dev server on the workerd runtime (`http://localhost:4321`).
- `npm run lint` / `npm run lint:fix` — ESLint with type-checked rules.
- `npx astro check` — type check (CI runs `npx astro sync` first).
- `npm run build` — production build.
- `npm run smoke` — auth-flow smoke test against a running server (`BASE_URL`); needs Supabase with email confirmation off.

## Project Structure

- `src/pages/` — routes; API endpoints in `src/pages/api/`.
- `src/middleware.ts` — sets `locals.user`; add guarded paths to `PROTECTED_ROUTES`.
- `src/components/` — shadcn/ui ("new-york") in `src/components/ui/`, added via `npx shadcn@latest add <name>`.
- `src/lib/` — helpers and the Supabase client (@src/lib/supabase.ts); business logic in `src/lib/services/`, shared types in `src/types.ts`.
- `supabase/migrations/YYYYMMDDHHmmss_short_description.sql` — schema changes.

## Coding Style

- Prettier (@.prettierrc.json) and ESLint (@eslint.config.js); husky + lint-staged fix staged files on commit. Files use LF (@.gitattributes).
- Import from `src` through the `@/` alias.
- Merge Tailwind classes with `cn()` from `@/lib/utils`, never by string concatenation.
- No Next.js directives (`"use client"`); put React hooks in `src/components/hooks/`.

## Testing

No test framework yet; `scripts/smoke.mjs` is the only automated check. Add a runner before writing tests.

## Commits & CI

- Short imperative, sentence-case subjects (e.g. `Enforce LF line endings via .gitattributes`); no prefix convention.
- Run `npm run lint` and `npx astro check` before pushing (@.github/workflows/ci.yml).
