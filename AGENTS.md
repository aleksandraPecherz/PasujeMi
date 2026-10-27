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
- `src/middleware.ts` — sets `locals.user`; every route requires sign-in except `PUBLIC_PREFIXES` (`/auth/`, `/api/auth/`). Signed-out `/api/*` gets 401, pages redirect to `/auth/signin`.
- `src/layouts/AppLayout.astro` — shell (header + content) for signed-in pages.
- `src/components/` — shadcn/ui ("new-york") in `src/components/ui/`, added via `npx shadcn@latest add <name>`.
- `src/lib/` — helpers and the Supabase client (@src/lib/supabase.ts); business logic in `src/lib/services/`, shared types in `src/types.ts`.
- `supabase/migrations/YYYYMMDDHHmmss_short_description.sql` — schema changes.
- `docs/reference/recipe-data-contract.md` — recipe shape and conversion rules from the local `data/recipes.xlsx` (gitignored, only on the author's machine); `supabase/seed.sql` — test data for local/CI only.

## Coding Style

- Prettier (@.prettierrc.json) and ESLint (@eslint.config.js); husky + lint-staged fix staged files on commit. Files use LF (@.gitattributes).
- Import from `src` through the `@/` alias.
- Merge Tailwind classes with `cn()` from `@/lib/utils`, never by string concatenation.
- No Next.js directives (`"use client"`); put React hooks in `src/components/hooks/`.

## UI

- Tokens live in `src/styles/global.css`: values in `:root` / `.dark`, published to Tailwind via `@theme inline`. Dark theme comes from `class="dark"` on `<html>` in `src/layouts/Layout.astro`; Soft Modern v2 hex values and their source mockups are in `palette.md` of the `soft-modern-foundation-auth` change (`context/changes/`, or `context/archive/` once archived). Font: Plus Jakarta Sans (`@fontsource-variable/plus-jakarta-sans`, self-hosted).
- Check `src/components/ui/` before creating a component; add a missing one with `npx shadcn@latest add <name>`. A missing look is a new variant in `ui/`, not a color in `className`.
- No literal colors or arbitrary values (`bg-purple-600`, `#0a0e1a`, `p-[13px]`) in views — use tokens. `npm run check:ui` (also run by lint-staged and CI) guards the files listed in `CLEAN_FILES` in `scripts/check-ui-literals.mjs`; add a file there once you clean it. `src/components/ui/` is not scanned (upstream shadcn keeps literals like `text-white`, `ring-[3px]`), so a new variant there must use tokens only — the scan will not catch it.
- The look is Soft Modern v2: flat surfaces. Cards differ from the background by color (`bg-card`), not by shadow or border; borders stay on form fields and thin separators; shadow only on overlays (menu, sheet, dialog). `cardVariants()` and `Button` have no neo-brutal variants (`brutal`, `pressable`) and there are no `shadow-brutal*` tokens — do not bring them back.
- Sizes: primary actions are `Button size="lg"` (48 px), icon buttons `size="icon"` (44 px), fields 48 px with 16 px text; `default` and `sm` stay compact for secondary actions. Radius comes from `--radius` (12 px; cards `rounded-xl`).
- Kitchen sink: `/dev/kitchen-sink` (dev only) — add each new component state there when you create it.

## Testing

Vitest (`npm test`, also run by CI) picks up `src/**/*.test.ts` and `scripts/**/*.test.ts`. `scripts/smoke.mjs` covers the auth flow against a running server.

- Name tests under `src/pages/` `_<name>.test.ts`: Astro routes every `.ts` file in `src/pages`, and the `_` prefix excludes it.
- Test an endpoint with `vi.mock("@/lib/supabase")` — that module imports `astro:env/server`, which Vitest cannot resolve. Assert the status first, then the body.
- Patterns and open risks: `context/foundation/test-plan.md` §6.
- Agent hooks (`.claude/hooks/`, wired in `.claude/settings.json`): after each Write/Edit, ESLint + check:ui and `vitest related` on that file; at Stop, the same on every changed file, then `vitest run` and `npx astro check`, with one retry. They signal through stderr + exit 2. Proof: `scripts/agent-hooks.test.ts`. Restart the session after changing them.

### Mutation testing

Stryker is a selective, local gate — not part of `npm test` or CI. After a risk phase run `npx stryker run --mutate "<file>"` and open `reports/mutation/mutation.html`. For each surviving mutant ask whether it would harm a user: if so add an assertion that kills it, otherwise ignore it on purpose. Don't chase 100%.

## Commits & CI

- Short imperative, sentence-case subjects (e.g. `Enforce LF line endings via .gitattributes`); no prefix convention.
- Run `npm run lint` and `npx astro check` before pushing (@.github/workflows/ci.yml).
- Windows: when `git mv` or `mv` of a folder fails with `Permission denied` (e.g. `/10x-archive`), move it yourself with `powershell -NoProfile -Command "Move-Item <src> <dest>"`, then stage both paths by name (`git add <src> <dest>`) so git records a rename, and continue. Don't ask the user to move it by hand.
