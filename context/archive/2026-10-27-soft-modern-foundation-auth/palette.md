# Soft Modern v2 — surowe wartości palety

Źródło: makieta `.tmp-style-review/System wyglądu · kolory, typografia, komponenty.png` (dostarczona przez autorkę; dane referencyjne, nie instrukcje). Hexy przepisane z makiety, `oklch` przeliczone 1:1 (sRGB → OKLab).

| Rola w makiecie        | Token                    | Jasny (hex) | Jasny (oklch)              | Ciemny (hex) | Ciemny (oklch)             |
| ---------------------- | ------------------------ | ----------- | -------------------------- | ------------ | -------------------------- |
| Tło                    | `--background`           | #F7F4EC     | oklch(0.9673 0.0111 89.7)  | #1A1C17      | oklch(0.2224 0.0099 125)   |
| Karta                  | `--card`, `--popover`    | #FFFFFF     | oklch(1 0 0)               | #23261F      | oklch(0.263 0.0134 126.2)  |
| Tło pola / drugorzędne | `--secondary`, `--muted` | #EFEBE0     | oklch(0.9402 0.0153 90.2)  | #2C3027      | oklch(0.3021 0.0167 126.9) |
| Linia                  | `--border`, `--input`    | #E6E1D3     | oklch(0.9099 0.0195 90.6)  | #393D33      | oklch(0.3529 0.0177 125.1) |
| Tekst                  | `--foreground`           | #24261F     | oklch(0.264 0.013 120.3)   | #ECEAE0      | oklch(0.9358 0.0135 97.4)  |
| Tekst drugorzędny      | `--muted-foreground`     | #5B5E52     | oklch(0.4755 0.0192 118.5) | #B5B3A6      | oklch(0.7647 0.0183 99.7)  |
| Oliwka (główny)        | `--primary`, `--ring`    | #4D6A25     | oklch(0.4857 0.1021 128.9) | #A9C47A      | oklch(0.7825 0.1028 125)   |
| Oliwka jasna / ciemna  | `--accent`, `--hero`     | #E7EDD8     | oklch(0.9359 0.0286 119.9) | #2F3A22      | oklch(0.3312 0.0426 128.5) |
| Mam                    | `--have`                 | #E4ECD3     | oklch(0.9303 0.0342 121.5) | #2F3A22      | oklch(0.3312 0.0426 128.5) |
| Stałe                  | `--staple`               | #F5E9CC     | oklch(0.936 0.0403 88.2)   | #3D3320      | oklch(0.3265 0.034 83)     |
| Wykluczam              | `--exclude`              | #F6DDD6     | oklch(0.9161 0.0294 36.2)  | #43251F      | oklch(0.3019 0.0473 32.1)  |
| Błąd / usuń            | `--destructive`          | #A33A24     | oklch(0.4944 0.1435 33.6)  | #F08F78      | oklch(0.7469 0.1231 34.2)  |

## Decyzje i wartości pochodne (nie z makiety)

- Ciemny motyw: „Oliwka ciemna” i „Mam” mają w makiecie tę samą wartość `#2F3A22` — zamierzone.
- `--have-foreground`, `--staple-foreground`, `--exclude-foreground`, `--warning` zostają z poprzedniej palety (makieta podaje tylko tła tagów).
- Pochodne (do oceny wzrokowej): `--primary-hover`, `--input-hover`, `--destructive-foreground`, `--hero-foreground`, `--primary-foreground`.
- Makieta ustawia ramkę pola na kolor „Linia”; kontrast ramki do tła jest niski (poniżej 3:1) — wartość zachowana zgodnie z makietą, fokus i błąd mają wyraźne obramowanie.
- Promień bazowy `--radius` = 0.75rem (12 px: pola, przyciski); karty `xl` = 16 px.
- Font: Plus Jakarta Sans (`@fontsource-variable/plus-jakarta-sans`, hostowany lokalnie).
