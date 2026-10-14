---
change_id: ui-pantry-tokens
title: Ui pantry tokens
status: implemented
created: 2026-10-14
updated: 2026-10-14
archived_at: null
---

## Notes

- View: `/` — `src/pages/index.astro` → `AppLayout.astro`, `AppHeader.astro`, `pantry/PantryMatch.tsx`, `pantry/TagInput.tsx`, `recipes/RecipeTile.tsx`.
- Token source: `src/styles/global.css` (`:root` / `.dark` → `@theme inline`). Contract variant: fresh starter with a dead token file — the view paints its own dark theme (`bg-cosmic`, `white/10`, `purple-600`) and reads no tokens.
- Pre-audit (2026-10-14, /10x-ui): 25 hard-coded hits, 0 token classes across the 6 view files.
