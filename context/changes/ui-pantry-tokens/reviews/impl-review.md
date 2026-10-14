<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Widok spiżarki na tokenach

- **Plan**: context/changes/ui-pantry-tokens/plan.md
- **Scope**: Full plan (completed phases only; Phase 3 excluded — Progress item 3.7 still `[ ]`)
- **Reviewed phases**: 1, 2, 4
- **Date**: 2026-10-14
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 6 observations

Note: Phase 3 files were read where they touch reviewed phases (CLEAN_FILES guard, shared tokens); F3 is in Phase 3 code but is a regression of behaviour that existed before the change. Phase 3 is not counted as reviewed coverage.

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | WARNING |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

Automated checks run: `npm run lint` ✅, `npx astro check` ✅ (0/0/0), `npm test` ✅ (82 passed, includes `scripts/check-ui-literals.test.ts`), `npm run build` ✅, `npm run check:ui` ✅, `class="dark"` count 1 ✅, `bg-cosmic` hex 0 ✅, `@theme inline` raw values 0 ✅, `skeleton.tsx` exists ✅, CI `check:ui` count 1 ✅. Screenshots `before/` (8 files incl. `/`) present.

## Findings

### F1 — Hover rework not reflected in plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence / Scope Discipline
- **Location**: src/components/ui/button.tsx:12,16,18; src/components/ui/input.tsx:11; src/styles/global.css:46-47,63,89-90,136-137
- **Detail**: Commit e4d59c9 added `--primary-hover` / `--input-hover`, raised `.dark --accent` from `white/10` to 20%, changed the `default`/`outline`/`ghost` hover in `button.tsx` and added `enabled:hover:border-input-hover` to `input.tsx` — because hover was invisible (≈1.12–1.16 contrast). Justified in `tokens.md` ("Poprawka hover"), but plan.md "What We're NOT Doing" (lines 60-63) still says hover is `primary/90` / `input/50` and that `ui/` stays unchanged except for Badge variants. Side effect: `Skeleton` (`bg-accent`) is brighter.
- **Fix**: Add a dated addendum to plan.md (Faza 1 point 2 + "What We're NOT Doing") pointing to the `tokens.md` "Poprawka hover" section.
- **Decision**: FIXED — entry added to plan.md "Addendum: przegląd implementacji"

### F2 — Focus ring on borderless buttons below 3:1

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/ui/button.tsx:8; src/styles/global.css:68
- **Detail**: Button base uses `focus-visible:ring-ring/50`. `--ring` (purple-400) at 50% over `--background` ≈ 2.6:1, below WCAG 1.4.11 non-text 3:1. `default` and `ghost` buttons have no border, so `focus-visible:border-ring` does nothing and the ring is their only indicator. The tag-remove × previously had full-opacity `ring-purple-400` — now weaker. Plan's Desired End State promises "widoczny fokus". Input and `outline` buttons are fine (full `border-ring`).
- **Fix A ⭐ Recommended**: In `ui/button.tsx` base, change `focus-visible:ring-ring/50` to `focus-visible:ring-ring`.
  - Strength: Targets exactly the controls that fail; `--ring` value from tokens.md (migrated `purple-400`) stays intact.
  - Tradeoff: Another deviation from upstream shadcn in `ui/`; ring looks heavier.
  - Confidence: HIGH — full-opacity purple-400 on navy is well above 3:1 (the old × ring).
  - Blind spot: Not re-measured on `bg-card` surfaces; destructive variant overrides its own ring.
- **Fix B**: Lighten/opacify dark `--ring` (e.g. purple-300).
  - Strength: One token fixes button, `outline-ring/50` links and auth `PasswordToggle` too.
  - Tradeoff: Changes a migrated value; affects auth screens (out of scope) and the tokens.md source mapping.
  - Confidence: MED — needs measurement of every `/50` use.
  - Blind spot: Effect on Input `border-ring` look.
- **Decision**: FIXED via Fix A — `ui/button.tsx` `focus-visible:ring-ring`; ring 6.91:1 on background, 5.41:1 on card (was 2.55:1); recorded in tokens.md

### F3 — LimitNotice live region mounted with its content

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/pantry/PantryStates.tsx:8 (used at PantryMatch.tsx:68)
- **Detail**: `LimitNotice` returns `null` without a message, so `<p role="status">` is inserted together with its text. Screen readers often skip live regions inserted with content. Before the change the `<p role="status" class="empty:hidden">` was always in the DOM (8faa5fd PantryMatch.tsx:66) — this is an a11y regression of the PRD's "status także tekstem dla czytnika ekranu" spirit. (Phase 3 code.)
- **Fix**: Always render `<p role="status">` and render icon + text only when `message !== null`.
- **Decision**: FIXED — region always mounted with `empty:hidden`, content conditional

### F4 — Literal scanner misses common colour/arbitrary forms

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: scripts/check-ui-literals.mjs:22-23
- **Detail**: Verified misses: `border-t-white`, `border-x-red-500`, `ring-offset-white`, `decoration-red-500`, `caret-white`, `accent-pink-500`, `p-[13px_4px]`, `w-[calc(100%-13px)]`, `top-[-3px]`, `h-[50vh]`, `text-[0.8em]`, `bg-[red]`, `[color:red]`, inline `style`. Real case: `SubmitButton.tsx:22` uses `border-t-white` and would pass once added to CLEAN_FILES (C5). False positive: `href="#add"` matches hex. The regex is exactly the one the plan specified — a plan gap, not drift.
- **Fix**: Extend prefixes to `border(-[xytrblse])?|ring(-offset)?|decoration|caret|accent`, flag any `-\[…\]` containing a digit+unit, `#`, `rgb|hsl|oklch` or a bare colour word, plus `\[[a-z-]+:`; add these cases to `check-ui-literals.test.ts`.
  - Strength: Closes the gaps before C5 adds the auth files, where `border-t-white` already exists.
  - Tradeoff: Broader regex → more false positives (e.g. `grid-cols-[200px_1fr]` layout values); may need an allow comment.
  - Confidence: MED — patterns verified by probing, new regex not yet run over the codebase.
  - Blind spot: Inline `style={{…}}` still unguarded unless added separately.
- **Decision**: FIXED — regex widened, 27 scanner tests pass, `check:ui` exit 0

### F5 — Scanner resolves CLEAN_FILES against cwd and crashes on missing entry

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/check-ui-literals.mjs:41-48
- **Detail**: Run from another directory, or after a CLEAN_FILES file is renamed/deleted, the script dies with an uncaught ENOENT stack trace (exit 1) instead of a clear message. Windows lint-staged paths normalise correctly (verified).
- **Fix**: Resolve against the repo root from `import.meta.url` and print `missing file in CLEAN_FILES: <path>` before exiting 1.
- **Decision**: FIXED — ROOT derived from `import.meta.url`; missing entry reported as a hit (exit 1); verified from repo root, `src/`, and a Windows absolute path

### F6 — Kitchen-sink client chunk ships in production build

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/dev/kitchen-sink.astro:2
- **Detail**: The route 404s in prod (`import.meta.env.DEV` is a build constant; middleware runs first), but `client:load` makes Astro emit `dist/client/_astro/KitchenSink.*.js`, served publicly as a static asset. Contains only sample data, no secrets.
- **Fix**: Accept and note in plan; inject the route only in dev if it ever holds real data.
- **Decision**: ACCEPTED — bundle holds sample data only and the page 404s in production; recorded as a deliberate decision in the plan.md addendum, no code change

### F7 — `ui/` variants are not guarded by the scanner

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: scripts/check-ui-literals.mjs (CLEAN_FILES); AGENTS.md:37
- **Detail**: AGENTS.md now routes every new look into `ui/` variants, but `ui/*.tsx` is outside CLEAN_FILES (upstream literals like `text-white`, `ring-[3px]` exist), so a new variant can reintroduce literal colours unnoticed.
- **Fix**: Add the four touched `ui/` files to the scan with a per-line allow marker for upstream lines, or document the exception in AGENTS.md.
- **Decision**: FIXED (differently) — exception documented in AGENTS.md `## UI`; no scanner change

### F8 — AGENTS.md Testing section is stale

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: AGENTS.md:45
- **Detail**: Says "No test framework yet; `scripts/smoke.mjs` is the only automated check", while Vitest runs `src/**/*.test.ts` and `scripts/**/*.test.ts` (82 tests) and CI runs `npm test`. This change edited AGENTS.md and vitest config.
- **Fix**: Replace with "Vitest (`npm test`) — `src/**/*.test.ts`, `scripts/**/*.test.ts`; `scripts/smoke.mjs` for the auth flow."
- **Decision**: FIXED — Testing section names Vitest, both globs and CI

### F9 — Skeleton pulse ignores reduced motion

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/ui/skeleton.tsx:4
- **Detail**: `animate-pulse` runs regardless of `prefers-reduced-motion`.
- **Fix**: Add `motion-reduce:animate-none` to the skeleton base.
- **Decision**: FIXED

### F10 — Translucent `--card` diverges from other dark surfaces

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/styles/global.css:53
- **Detail**: `.dark --card` is `oklch(1 0 0 / 10%)` while `--popover`, `--secondary`, `--muted` remain opaque shadcn greys. A future shadcn Card/Popover/Select expecting a solid `bg-card` or palette-matching popover will be see-through or off-palette.
- **Fix**: Note in tokens.md that `--card` is translucent by design and `--popover`/`--muted` are not yet migrated.
- **Decision**: ACCEPTED — translucent `--card` is deliberate (lets `bg-cosmic` show through); note added to tokens.md, no code change; revisit when the palette changes
