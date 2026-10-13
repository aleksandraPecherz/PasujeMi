// Query-string parsing shared by API endpoints.

// Missing parameter -> fallback; anything but a plain non-negative integer -> null.
export function parseIntParam(value: string | null, fallback: number): number | null {
  if (value === null) {
    return fallback;
  }
  if (!/^\d+$/.test(value)) {
    return null;
  }
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}
