# Review fixes

- F1 (skipped): scripts/match-keys.ts updates keys filtered by `id` only; a concurrent ingredient edit between read and write can leave stale keys. Revisit if match-keys is run while authors edit.
