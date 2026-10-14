---
date: 2026-10-14T14:12:31Z
researcher: Aleksandra Pęcherz
git_commit: 8faa5fd
branch: ui-pantry-tokens
repository: PasujeMi
topic: "UI audit of the pantry view (/) against the design-system contract"
tags: [research, ui, design-tokens, shadcn, tailwind, pantry, recipe-tile]
status: complete
last_updated: 2026-10-14
last_updated_by: Aleksandra Pęcherz
---

# Research: UI audit of the pantry view (`/`) against the design-system contract

**Date**: 2026-10-14T14:12:31Z
**Researcher**: Aleksandra Pęcherz
**Git Commit**: 8faa5fd
**Branch**: ui-pantry-tokens
**Repository**: PasujeMi

## Research Question

Where do the values and shared components of the `/` view live, which of them does the view actually read, and
which literals in the view should a token or component have covered? Output: 3–5 charges with `file:line` and user
impact (`/10x-ui` audit, both directions).

View files (6): `src/pages/index.astro`, `src/layouts/AppLayout.astro`, `src/components/AppHeader.astro`,
`src/components/pantry/PantryMatch.tsx`, `src/components/pantry/TagInput.tsx`,
`src/components/recipes/RecipeTile.tsx`. Token source: `src/styles/global.css`.

## Summary

The repo ships a complete, correctly wired shadcn token contract — values in `:root` (`global.css:6`) and `.dark`
(`global.css:41`), published by `@theme inline` (`global.css:75`) — and nothing in the view reads it. Across the 6
view files the hard-coded scan finds 25 matching lines and 0 token classes. The view paints its own dark theme
(`bg-cosmic` hex gradient at `global.css:113`, `white/10` surfaces, `purple-600` accent), while the active tokens
are the light neutral `:root` set, because no element sets `.dark` (`Layout.astro:14` `<html lang="pl">`, `:21`
`<body>`). shadcn components are imported (Button ×2, Input, Badge ×2) but their token-based colors are
overridden with literals through `cn()` = `twMerge(clsx(...))` (`src/lib/utils.ts:4-5`).

Contract variant: **fresh starter with a dead token file**. Phase 1 is not choosing a theme: it is moving the
palette the view already uses into the token values and making the view read them.

No earlier decision exists on theme, dark mode, palette, `bg-cosmic`, contrast, focus or loading visuals (searched
`context/foundation/**`, `context/archive/**`, `docs/**`, AGENTS.md, CLAUDE.md). The UI requirements that do
exist are behavioral and must survive the restyle (see Historical Context).

## Charges

### C1 — Dead token file: the view's dark palette is not in the tokens (missing tokens)

- **Evidence**: `src/layouts/AppLayout.astro:13` `bg-cosmic min-h-screen text-white`; `src/styles/global.css:113`
  `@utility bg-cosmic` with hex `#0a0e1a/#0f1529`; `global.css:6-39` light neutral values (`--primary:
oklch(0.205 0 0)` at `:14`, `--ring: oklch(0.708 0 0)` at `:25`); `Layout.astro:14,21` set no `.dark`.
  Surfaces repeat `border-white/10 bg-white/10 backdrop-blur-xl` at `PantryMatch.tsx:38`, `RecipeTile.tsx:55`,
  `AppHeader.astro:5` (`bg-white/5`); muted text `text-blue-100/70|80` at `AppHeader.astro:11`,
  `PantryMatch.tsx:43,88,93,106`, `TagInput.tsx:38`.
- **User impact**: the colors a user sees are restated in every file, so a changed accent or surface needs ~25
  edits and drifts (already three muted-text opacities: /60 on auth, /70, /80); every shadcn default
  (`bg-primary` near-black, `text-foreground` near-black, `--ring` light grey) is wrong on the dark background,
  which is why each use overrides it.
- **Fix direction**: put the cosmic palette into token values (either `:root` becomes the dark palette, or
  `class="dark"` on `<html>` with `.dark` values) — background, foreground, card, muted-foreground, primary,
  border, input, ring; express `bg-cosmic` via tokens; view uses `bg-card`, `text-muted-foreground`, etc.

### C2 — Match semantics have no role tokens (missing tokens)

- **Evidence**: section tag colors `PantryMatch.tsx:13` (emerald, have), `:19` (blue, staple), `:25` (red,
  exclude); tile "mam" tag `RecipeTile.tsx:29` (emerald, a different alpha: `/20` vs `/15`); "brak informacji"
  `RecipeTile.tsx:29` and no-match tag `RecipeTile.tsx:17` (`white/5`, text `/60` vs `/80`); percent badge
  `RecipeTile.tsx:59` `bg-purple-600` shares the accent with the primary button `PantryMatch.tsx:73`.
- **User impact**: the PRD gives color a meaning ("zielony = mam, szary = brak informacji", `prd.md:38-41,124`);
  the green for "Mam w domu" in the pantry and the green "mam" on the tile are two separate literals, so the
  meaning can silently diverge, and "Wykluczam" red is not tied to `destructive`.
- **Fix direction**: semantic role tokens (e.g. `--have`, `--staple`, `--exclude` → or reuse `destructive` for
  exclude) published via `@theme inline`; one Badge variant per role instead of per-call classes.

### C3 — shadcn components bypassed or overridden (missing shared component / variant)

- **Evidence**:
  - `PantryMatch.tsx:73` primary action: `Button` with `bg-purple-600 … hover:bg-purple-500` overriding `default`.
  - `PantryMatch.tsx:115` "Pokaż więcej": `Button` with `border-white/20 bg-white/10 … hover:bg-white/20`
    re-implementing `outline` (`button.tsx:16`).
  - `AppHeader.astro:15` "Wyloguj": a raw `<button>` with the same literal set (Astro file, cannot import the
    React `Button`; can use `buttonVariants` classes).
  - `TagInput.tsx:54` `Input` overridden (`border-white/20 bg-white/10 text-white placeholder:text-white/40
focus-visible:ring-purple-400/60`); `TagInput.tsx:68-74` tag remove control is a raw `<button>` with its own
    `focus-visible:ring-2 ring-purple-400`.
  - Outside the view, same pattern: `auth/SubmitButton.tsx:18` (purple override), `auth/FormField.tsx:6,53` raw
    `<input>` not `ui/Input`.
- **User impact**: three buttons with the same role have three hover/focus treatments; keyboard focus is a purple
  ring on the tag input and remove ×, but `button.tsx:8` base `ring-ring/50` (light grey at 50 % on dark) on both
  Buttons — focus is barely visible on "Zastosuj filtry" and "Pokaż więcej".
- **Fix direction**: once C1 tokens are dark, use `Button` `default` / `outline` / `ghost` unmodified (size/width
  only), `buttonVariants()` in `AppHeader.astro`, plain `Input`, `Button size="icon"`-like ghost for remove ×.

### C4 — States are literal or missing (error, notice, loading)

- **Evidence**:
  - error: `auth/ServerError.tsx:11` `border-red-500/30 bg-red-900/30 text-red-300`, no `role="alert"` (only
    `PantryMatch.tsx:66,106` carry `role="status"`); a pantry error is not announced and does not use
    `destructive`. The component lives under `auth/` but is shared (`PantryMatch.tsx:2`).
  - limit notice: `PantryMatch.tsx:66` `text-amber-200`, color is the only signal (no icon).
  - loading: `PantryMatch.tsx:106-108` a text line under the list; on first load the list area is empty, then
    tiles push the line down (layout shift); on re-apply the old tiles stay with no busy styling (only
    `aria-busy`, `PantryMatch.tsx:80`).
  - disabled: "Zastosuj filtry" relies on `button.tsx:8` `disabled:opacity-50`; full section input
    `TagInput.tsx:49-50` disabled with placeholder "Limit 30 produktów" over `placeholder:text-white/40`.
  - empty: both empty texts exist (`PantryMatch.tsx:87-94`), no shared empty-state style.
- **User impact**: a failed match request shows a red box that screen readers do not announce; the limit notice
  reads as decoration; the first load jumps when 10 tiles arrive. These are the 3 manual checks left open by S-03
  (`context/archive/2026-10-12-first-pantry-match/reviews/impl-review.md:156`).
- **Fix direction**: phase "states" with the 7-state matrix; `destructive` token for error, `role="alert"`;
  skeleton tiles (shadcn `skeleton`) of tile height during loading; notice with icon + token.

### C5 — Auth screens duplicate the cosmic shell (accidental architecture) — **deferred**

- **Evidence**: `src/pages/auth/signin.astro:10-12`, `signup.astro:10-12`, `confirm-email.astro:22-25` each
  repeat `bg-cosmic`, the card `border-white/10 bg-white/10` and the `from-blue-200 to-purple-200` gradient title
  (also `AppHeader.astro:7`); `components/Banner.astro:28-40` hex colors.
- **User impact**: once `/` reads tokens, the auth pages keep the literals; a later palette change leaves the
  sign-in screen in the old colors.
- **Why deferred**: one view per change (`/10x-ui`). The global token edit must not visibly change the auth pages
  (they use literals, and `bg-cosmic` covers `body { bg-background }`); verify that with a screenshot. Follow-up
  change: auth screens onto the same tokens.

## Detailed Findings

### Source → views

| File                         | Hard-coded lines | Token classes | `ui/` imports      |
| ---------------------------- | ---------------- | ------------- | ------------------ |
| `pages/index.astro`          | 0                | 0             | —                  |
| `layouts/AppLayout.astro`    | 1                | 0             | —                  |
| `components/AppHeader.astro` | 4                | 0             | — (raw `<button>`) |
| `pantry/PantryMatch.tsx`     | 11               | 0             | Button ×2          |
| `pantry/TagInput.tsx`        | 4                | 0             | Input, Badge       |
| `recipes/RecipeTile.tsx`     | 5                | 0             | Badge              |

Counts are matching lines of the `/10x-ui` scan regex, run on 2026-10-14 at `8faa5fd`. Outside the view, the same
scan gives 0 token classes in every file under `src/pages`, `src/layouts`, `src/components` except
`src/components/ui/*` (auth pages 4 lines each, `FormField.tsx` 5, `Banner.astro` 9).

- `components.json`: style `new-york`, baseColor `neutral`, `cssVariables: true`, css `src/styles/global.css`.
- `button.tsx` variants: default, destructive, outline, secondary, ghost, link; base carries
  `focus-visible:ring-ring/50 ring-[3px]`, `disabled:opacity-50`, `aria-invalid:border-destructive` (`:8-19`).
- `badge.tsx` variants: default, secondary, destructive, outline, ghost, link (`:11-17`); no disabled style.
- `input.tsx`: no variants; `placeholder:text-muted-foreground`, `dark:bg-input/30`, focus `ring-ring/50`
  (`:10-12`).
- `global.css:4` `@custom-variant dark (&:is(.dark *))` — every `dark:` class in `ui/` is currently inert.

### View → source (what should have covered each literal)

| Literal (where)                                                                 | Should be                                         |
| ------------------------------------------------------------------------------- | ------------------------------------------------- |
| `bg-cosmic`, `text-white` (`AppLayout.astro:13`)                                | `bg-background text-foreground` with dark values  |
| `bg-white/10 border-white/10` cards (`PantryMatch.tsx:38`, `RecipeTile.tsx:55`) | `bg-card border-border`                           |
| `text-blue-100/70                                                               | 80`                                               | `text-muted-foreground` |
| `bg-purple-600` (`PantryMatch.tsx:73`, `RecipeTile.tsx:59`)                     | `primary`                                         |
| `focus-visible:ring-purple-400` (`TagInput.tsx:54,74`)                          | `ring`                                            |
| emerald/blue/red tag classes                                                    | role tokens (C2)                                  |
| `red-*` error (`ServerError.tsx:11`)                                            | `destructive`                                     |
| `amber-200` notice (`PantryMatch.tsx:66`)                                       | a warning role token or `muted-foreground` + icon |

### Entry point (accidental-architecture check)

- Signed out: `src/middleware.ts` redirects pages to `/auth/signin` (AGENTS.md "Project Structure"); no raw JSON on
  `/`. No charge.
- No data: both empty states render text (`PantryMatch.tsx:87-94`); no raw JSON. Only styling (C4).
- Direct link: `/` has no params; state is client-only. No charge.
- 404 has no app shell (deferred F4 of S-01, `context/archive/*login-gated-app-shell-review/follow-ups/review-fixes.md:3`)
  — not this view.

## Code References

- `src/styles/global.css:6-39` — light `:root` values; `:41-73` `.dark`; `:75-111` `@theme inline`; `:113` `bg-cosmic`
- `src/layouts/Layout.astro:2,14,21` — global.css import; `<html>` / `<body>` without `.dark`
- `src/layouts/AppLayout.astro:13` — cosmic wrapper
- `src/components/AppHeader.astro:5,7,11,15` — header surface, gradient title, muted email, raw button
- `src/components/pantry/PantryMatch.tsx:13,19,25,38,43,66,73,87-94,106-108,115`
- `src/components/pantry/TagInput.tsx:38,49-50,54,65,68-74`
- `src/components/recipes/RecipeTile.tsx:17,29,55,57,59`
- `src/components/auth/ServerError.tsx:11`
- `src/components/ui/button.tsx:8-19`, `badge.tsx:7-17`, `input.tsx:10-12`
- `src/lib/utils.ts:4-5` — `cn` = `twMerge(clsx())`, so view literals override variant tokens

## Architecture Insights

- The `:root`/`.dark` → `@theme inline` split is already correct; only the values and the consumers are wrong.
  Raw colors must not be written into `@theme inline` (breaks the `.dark` switch).
- Because `cn` uses tailwind-merge, overriding a variant via `className` silently wins — the pattern that let the
  literals spread. A token-backed variant (or a new variant in `badge.tsx`) is the extension point.
- `AppHeader.astro` is Astro, not React: it can reuse `buttonVariants` from `@/components/ui/button` for classes.
- shadcn components are added with `npx shadcn@latest add <name>` (`AGENTS.md:24`); `skeleton` is not yet in
  `src/components/ui/`.

## Historical Context (from prior changes)

- `context/foundation/prd.md:37,65,95` — empty pantry: prompt "Wypełnij spiżarkę…" above 10 recipes without %;
  must stay. Supported, current code matches (`PantryMatch.tsx:81-83`).
- `prd.md:38-41,124` — tile tags green = mam, grey = brak informacji. Supported; C2 keeps the meaning, moves the
  values.
- `prd.md:114` — usable on phone and desktop. Only responsive NFR; no accessibility/contrast NFR.
- `context/archive/2026-10-12-first-pantry-match/plan.md:318-325` — status given as screen-reader text, not only
  color. Supported (`RecipeTile.tsx:46`, `:37` sr-only spans).
- `context/archive/*login-gated-app-shell*/plan.md:77` — header "styl spójny z ekranami auth". Supported today;
  C5 deferral temporarily breaks it — the plan must decide whether header literals move with the view.
- `context/archive/2026-10-12-first-pantry-match/plan.md:309-313` — `input`/`badge` added via shadcn CLI "bez
  ręcznych przeróbek". Supported for the files; the overrides happen at the call sites.
- `context/archive/2026-10-12-first-pantry-match/reviews/impl-review.md:136-140,156` — F9 fixed (disabled apply,
  input kept on rejected tag); manual re-check of limit notice, kept input, disabled apply still open (follow-up
  line, not a Progress checkbox).
- `docs/experiments/2026-10-11-polish-ui-rule.md:10-14` — agents reused `bg-cosmic` on their own in 3/3 runs; an
  observation, not a decision. It is evidence of how literals propagate.

## Related Research

- `context/archive/2026-10-12-first-pantry-match/research.md:109-111` — UI inventory before S-03 (only
  `button.tsx`).

## Open Questions

1. **Dark how**: make `:root` the cosmic palette (single theme), or add `class="dark"` on `<html>` and put the
   cosmic palette into `.dark` (keeps a light theme available)? No product requirement either way.
2. **Keep the gradient?** `bg-cosmic` as a token-backed utility (`--background` + a second stop token) or a flat
   `bg-background`.
3. **Header and C5**: does the header move to tokens in this change (it is in `AppLayout`, so it is part of `/`),
   leaving auth pages on literals until the follow-up?
4. **Visual gate**: no Playwright/screenshot tool in the repo; a kitchen-sink page (e.g. dev-only route) is the
   cheapest gate — where it lives and whether it is excluded from production is a plan decision.
