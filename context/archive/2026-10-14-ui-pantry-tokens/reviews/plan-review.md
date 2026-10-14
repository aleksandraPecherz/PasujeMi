<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Widok spiżarki na tokenach

- **Plan**: context/changes/ui-pantry-tokens/plan.md
- **Mode**: Deep
- **Date**: 2026-10-14
- **Verdict**: REVISE → SOUND (po poprawkach)
- **Findings**: 1 critical, 2 warnings, 1 observation

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | WARNING |
| Blind Spots           | WARNING |
| Plan Completeness     | FAIL    |

## Grounding

10/10 paths ✓ (skeleton.tsx nowy), 5/5 symbols ✓, brief↔plan ✓, Progress↔Phase ✓ (28/28)

## Findings

### F1 — Test skanu nie uruchomi się w `npm test`

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Faza 4, punkt 1 (kryterium 4.2)
- **Detail**: `vitest.config.ts:12` ma `include: ["src/**/*.test.ts"]`, więc `scripts/check-ui-literals.test.ts` nie zostałby uruchomiony, a 4.2 przeszłoby bez testu.
- **Fix**: Rozszerzyć `include` o `scripts/**/*.test.ts`; 4.2 sprawdza, że wynik `npm test` wymienia test.
- **Decision**: FIXED (Fix in plan)

### F2 — `.dark` zmienia wygląd `/` już w Fazie 1

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Faza 1 (1.6, 1.7), Faza 2 (2.3), „What We're NOT Doing”
- **Detail**: Klasy `dark:` z `ui/` mają specyficzność (0,2,0) (`global.css:4`) i twMerge ich nie usuwa, więc wygrywają z literałami: tło pól `Input` `input/30` (`input.tsx:10`, ~6% zamiast 10% bieli), przyciski `outline` `input/30`/`input/50` (`button.tsx:16`), kolor fokusu (`--ring`, `* outline-ring/50`) i zaznaczenia (`--primary`), także na ekranach auth przy fokusie.
- **Fix A ⭐ Recommended**: Przyjąć różnice i zapisać je w planie oraz kryteriach
  - Strength: Warianty shadcn bez przeróbek.
  - Tradeoff: „Tak samo” = „tak samo poza listą”.
  - Confidence: HIGH — mechanizm potwierdzony w kodzie.
  - Blind spot: Wygląd 6% tła pól niesprawdzony na zrzucie.
- **Fix B**: `--input` ≈ white/33 pod tło pól
  - Strength: Tło pól identyczne jak dziś.
  - Tradeoff: Jaśniejsze obramowania pól i przycisków outline.
  - Confidence: MEDIUM
  - Blind spot: Kontrast obramowania niesprawdzony.
- **Decision**: FIXED (Fix A)

### F3 — Kolor przez `className` na `Badge` w RecipeTile

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Faza 2, punkt 3 i Faza 1, punkt 4
- **Detail**: `variant="outline"` + `text-muted-foreground` to kolor w `className` na komponencie z `ui/`, sprzeczny z „Critical Implementation Details”; dziś dwa odcienie (`RecipeTile.tsx:17` white/80, `:29` white/60).
- **Fix**: Wariant `muted` w `badgeVariants` (Faza 1), `variant="muted"` w Fazie 2, scalone odcienie w `tokens.md`.
- **Decision**: FIXED (Fix in plan)

### F4 — Ścieżki z lint-staged i globalne w ESLint

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Faza 4, punkt 1
- **Detail**: lint-staged podaje ścieżki absolutne (Windows `\`), `CLEAN_FILES` względne; `eslint.config.js:76` zna w `scripts/**/*.mjs` tylko `console`, `process`, `fetch`, `URLSearchParams`.
- **Fix**: Normalizacja argumentów przez `path.relative` + `\`→`/`; importy `node:*`.
- **Decision**: FIXED (Fix in plan)
