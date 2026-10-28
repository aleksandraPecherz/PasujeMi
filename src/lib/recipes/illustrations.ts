/**
 * Static recipe illustrations: `public/illustrations/<key>.svg`, a plate and a dish on a transparent background.
 * The tone is the decorative tile background (`--illus-*` tokens); the database only checks the key format, so a new
 * illustration is an SVG file plus one line here.
 */
export type IllustrationTone = "green" | "yellow" | "pink" | "lilac";

const ILLUSTRATIONS = {
  kanapka: "green",
  "kanapka-jajko": "green",
  salatka: "green",
  wrap: "yellow",
  placek: "yellow",
  makaron: "yellow",
  zupa: "pink",
  miska: "pink",
  talerz: "pink",
  "slodka-miska": "lilac",
  szklanka: "lilac",
  deser: "lilac",
} as const satisfies Record<string, IllustrationTone>;

export const ILLUSTRATION_KEYS = Object.keys(ILLUSTRATIONS);

/** The illustration for a stored key; `null` for no key or an unknown one, so the caller shows the placeholder. */
export function resolveIllustration(key: string | null | undefined): { key: string; tone: IllustrationTone } | null {
  if (!key || !Object.hasOwn(ILLUSTRATIONS, key)) {
    return null;
  }
  return { key, tone: ILLUSTRATIONS[key as keyof typeof ILLUSTRATIONS] };
}
