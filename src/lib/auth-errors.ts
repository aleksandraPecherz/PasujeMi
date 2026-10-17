// Auth endpoints pass a Supabase error code in `?error=`; pages turn it into Polish copy here,
// so text from the URL is never rendered as-is.
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Nieprawidłowy e-mail lub hasło.",
  email_not_confirmed: "Potwierdź adres e-mail — link wysłaliśmy w wiadomości.",
  user_already_exists: "Konto z tym adresem e-mail już istnieje.",
  weak_password: "Hasło jest za słabe — użyj co najmniej 6 znaków.",
  email_address_invalid: "Podaj prawidłowy adres e-mail.",
  over_email_send_rate_limit: "Zbyt wiele prób. Spróbuj ponownie za chwilę.",
  over_request_rate_limit: "Zbyt wiele prób. Spróbuj ponownie za chwilę.",
  not_configured: "Logowanie jest chwilowo niedostępne.",
};

const FALLBACK_MESSAGE = "Coś poszło nie tak. Spróbuj ponownie.";

export function authErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return Object.hasOwn(AUTH_ERROR_MESSAGES, code) ? AUTH_ERROR_MESSAGES[code] : FALLBACK_MESSAGE;
}

// Longest valid e-mail address (RFC 5321 path limit); anything longer is dropped, not truncated.
export const MAX_EMAIL_LENGTH = 254;

function cleanEmail(value: string | null): string {
  const email = value?.trim() ?? "";
  return email.length <= MAX_EMAIL_LENGTH ? email : "";
}

// Builds the redirect after a failed auth attempt. It takes only the e-mail, so a password cannot end up in the URL.
export function authErrorRedirect(path: "/auth/signin" | "/auth/signup", code: string, email: string | null): string {
  const params = new URLSearchParams({ error: code });
  const cleaned = cleanEmail(email);
  if (cleaned) params.set("email", cleaned);
  return `${path}?${params.toString()}`;
}

export function emailFromQuery(value: string | null): string {
  return cleanEmail(value);
}
