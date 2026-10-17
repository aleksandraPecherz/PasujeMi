---
change_id: recipe-count
title: Recipe count
status: implemented
created: 2026-10-17
updated: 2026-10-17
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- PR: https://github.com/aleksandraPecherz/PasujeMi/pull/27 (draft, „Closes #24”).
- Weryfikacja ręczna 2.7–2.9 bez klikania na `/`: produkcja nie ma przepisów. Liczbę (`total`) sprawdził smoke na
  API na seedzie w CI (run 39055746175, `smoke` pass, kod z 95f7463); wygląd licznika sprawdzony w kitchen sink.
- 2.10: `npm run smoke` zielony w CI na tym samym runie.
- 2.6: kitchen sink sprawdzony tylko w ciemnym motywie; jasny dojdzie w #22.
