import { describe, expect, it } from "vitest";
import { MAX_EMAIL_LENGTH, authErrorMessage, authErrorRedirect, emailFromQuery } from "@/lib/auth-errors";

function queryOf(url: string) {
  return new URL(url, "http://localhost").searchParams;
}

describe("authErrorRedirect", () => {
  it("adds the encoded e-mail next to the error code", () => {
    const url = authErrorRedirect("/auth/signin", "invalid_credentials", "ola+test@example.com");
    expect(url).toBe("/auth/signin?error=invalid_credentials&email=ola%2Btest%40example.com");
    expect(emailFromQuery(queryOf(url).get("email"))).toBe("ola+test@example.com");
  });

  it("trims the e-mail", () => {
    expect(authErrorRedirect("/auth/signup", "user_already_exists", "  a@b.pl  ")).toBe(
      "/auth/signup?error=user_already_exists&email=a%40b.pl",
    );
  });

  it("keeps only the error when the e-mail is missing, empty or blank", () => {
    expect(authErrorRedirect("/auth/signin", "not_configured", null)).toBe("/auth/signin?error=not_configured");
    expect(authErrorRedirect("/auth/signin", "not_configured", "")).toBe("/auth/signin?error=not_configured");
    expect(authErrorRedirect("/auth/signin", "not_configured", "   ")).toBe("/auth/signin?error=not_configured");
  });

  it("drops an e-mail longer than the limit", () => {
    const long = `${"a".repeat(MAX_EMAIL_LENGTH - "@b.pl".length + 1)}@b.pl`;
    expect(authErrorRedirect("/auth/signin", "invalid_credentials", long)).toBe(
      "/auth/signin?error=invalid_credentials",
    );
  });
});

describe("emailFromQuery", () => {
  it("returns an empty string for a missing or too long value", () => {
    expect(emailFromQuery(null)).toBe("");
    expect(emailFromQuery("a".repeat(MAX_EMAIL_LENGTH + 1))).toBe("");
  });

  it("trims the value and accepts one at the limit", () => {
    expect(emailFromQuery("  a@b.pl ")).toBe("a@b.pl");
    const atLimit = "a".repeat(MAX_EMAIL_LENGTH);
    expect(emailFromQuery(atLimit)).toBe(atLimit);
  });
});

describe("authErrorMessage", () => {
  it("maps known codes, falls back for unknown ones and ignores a missing code", () => {
    expect(authErrorMessage("invalid_credentials")).toBe("Nieprawidłowy e-mail lub hasło.");
    expect(authErrorMessage("something_else")).toBe("Coś poszło nie tak. Spróbuj ponownie.");
    expect(authErrorMessage(null)).toBeNull();
  });
});
