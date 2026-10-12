// Smoke test: proves the built app, the Cloudflare adapter and the Supabase auth flow still work together.
// Zero dependencies on purpose. Run against a live server: BASE_URL=http://localhost:4321 node scripts/smoke.mjs

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const email = `smoke-${Date.now()}@example.com`;
const password = "Smoke-Test-Passw0rd!";
const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
    if (expired) jar.delete(name.trim());
    else jar.set(name.trim(), rest.join("="));
  }
}

async function request(path, { method = "GET", form } = {}) {
  const response = await fetch(BASE_URL + path, {
    method,
    redirect: "manual",
    headers: {
      Cookie: cookieHeader(),
      Origin: BASE_URL,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  storeCookies(response);
  const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
  const body = isJson ? await response.json() : undefined;
  return { status: response.status, location: response.headers.get("location") ?? "", body };
}

// `location` must match exactly; use `locationPrefix` when only the start is fixed (e.g. an error query).
// `check(body)` is an optional predicate on the parsed JSON body.
const steps = [
  ["anonymous root redirects to signin", () => request("/"), { status: 302, location: "/auth/signin" }],
  ["signin page renders for anonymous user", () => request("/auth/signin"), { status: 200 }],
  ["anonymous api request gets 401", () => request("/api/recipes"), { status: 401 }],
  [
    "signup creates account",
    () => request("/api/auth/signup", { method: "POST", form: { email, password } }),
    { status: 302, location: "/auth/confirm-email" },
  ],
  [
    "signin rejects wrong password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password: "wrong" } }),
    { status: 302, locationPrefix: "/auth/signin?error=" },
  ],
  [
    "signin accepts correct password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password } }),
    { status: 302, location: "/" },
  ],
  [
    "signed-in user reads recipes",
    () => request("/api/recipes"),
    {
      status: 200,
      // supabase/seed.sql loads 5 test recipes in CI.
      check: (body) =>
        Array.isArray(body?.recipes) &&
        typeof body?.hasMore === "boolean" &&
        body.recipes.length >= 5 &&
        body.recipes.every((recipe) => recipe.steps.length > 0 && recipe.ingredients.length > 0),
    },
  ],
  ["app shell renders for signed-in user", () => request("/"), { status: 200 }],
  ["signed-in user is sent away from signin", () => request("/auth/signin"), { status: 302, location: "/" }],
  [
    "signout clears session",
    () => request("/api/auth/signout", { method: "POST" }),
    { status: 302, location: "/auth/signin" },
  ],
  ["root redirects after signout", () => request("/"), { status: 302, location: "/auth/signin" }],
];

let failed = 0;
for (const [name, run, expected] of steps) {
  const actual = await run();
  const ok =
    actual.status === expected.status &&
    (expected.location === undefined || actual.location === expected.location) &&
    (expected.locationPrefix === undefined || actual.location.startsWith(expected.locationPrefix)) &&
    (expected.check === undefined || expected.check(actual.body));
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location}`);
  if (!ok) {
    failed++;
    console.log(`      expected ${expected.status} ${expected.location ?? expected.locationPrefix ?? ""}`);
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
