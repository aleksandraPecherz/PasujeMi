// Smoke test: proves the built app, the Cloudflare adapter and the Supabase auth flow still work together.
// Zero dependencies on purpose. Run against a live server: BASE_URL=http://localhost:4321 node scripts/smoke.mjs

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const email = `smoke-${Date.now()}@example.com`;
const password = "Smoke-Test-Passw0rd!";
const jar = new Map();
// A well-formed id that no recipe has; the middleware redirects anonymous requests before routing, so it needs no real id.
const UNKNOWN_RECIPE_ID = "00000000-0000-4000-8000-000000000000";

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

async function request(path, { method = "GET", form, json } = {}) {
  const response = await fetch(BASE_URL + path, {
    method,
    redirect: "manual",
    headers: {
      Cookie: cookieHeader(),
      Origin: BASE_URL,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(json ? { "Content-Type": "application/json" } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : json ? JSON.stringify(json) : undefined,
  });
  storeCookies(response);
  const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
  const body = isJson ? await response.json() : await response.text();
  return { status: response.status, location: response.headers.get("location") ?? "", body };
}

// The id of the signed-in user, read from the island props in the HTML of "/" (set by the "reads its own id" step).
let userId = "";
const UUID_IN_PROPS = /userId.{0,40}?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;

// Astro serializes island props into an HTML attribute; decode the entities so a tag with Polish letters is found
// whether it is written as is or as a numeric reference.
function decodeEntities(html) {
  return html
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

// 30 unique two-word staples (digits vanish in tokenize) + 1 exclusion = 61 words, over MAX_SAVED_TOKENS (60).
const overWordLimitPantry = {
  staple: Array.from({ length: 30 }, (_v, i) => `ser żółty ${i}`),
  exclude: ["orzechy"],
};

// Set by the "signed-in user adds a recipe" step; the edit and delete steps work on that recipe.
let addedRecipeId = null;
const EDITED_NAME = `Smoke edited ${Date.now()}`;

// Runs a step that needs the added recipe's id; fails readably (status 0) when the add step did not produce one.
function withAddedRecipe(run) {
  return async () => {
    if (addedRecipeId === null) {
      console.log('      no recipe id: the step "signed-in user adds a recipe" did not succeed');
      return { status: 0, location: "", body: null };
    }
    return run(addedRecipeId);
  };
}

// A valid recipe for POST /api/recipes. The ingredient is yogurt on purpose: the step that adds it runs after the
// pantry-match step and `exclude=jogurt` hides it, so a repeated run on a local database keeps `total === 4`.
function newRecipe(overrides = {}) {
  return {
    name: `Smoke ${Date.now()}`,
    steps: ["Wymieszaj."],
    ingredients: [{ name: "Jogurt naturalny", product: "", amount: 100, unit: "g", substitutes: [] }],
    ...overrides,
  };
}

// `location` must match exactly.
// `check(body, location)` is an optional predicate on the body (parsed JSON, otherwise text) and the `location`.
const steps = [
  ["anonymous root redirects to signin", () => request("/"), { status: 302, location: "/auth/signin" }],
  [
    "anonymous recipe details redirect to signin",
    () => request(`/recipes/${UNKNOWN_RECIPE_ID}`),
    { status: 302, location: "/auth/signin" },
  ],
  ["signin page renders for anonymous user", () => request("/auth/signin"), { status: 200 }],
  [
    "anonymous api request gets 401",
    () => request("/api/recipes"),
    { status: 401, check: (body) => body?.error === "unauthorized" },
  ],
  [
    "anonymous recipe post gets 401",
    () => request("/api/recipes", { method: "POST", json: newRecipe() }),
    { status: 401, check: (body) => body?.error === "unauthorized" },
  ],
  [
    "anonymous pantry save gets 401",
    () => request("/api/pantry", { method: "PUT", json: { ownerId: UNKNOWN_RECIPE_ID, staple: [], exclude: [] } }),
    { status: 401, check: (body) => body?.error === "unauthorized" },
  ],
  [
    "anonymous recipe put gets 401",
    () => request(`/api/recipes/${UNKNOWN_RECIPE_ID}`, { method: "PUT", json: newRecipe() }),
    { status: 401, check: (body) => body?.error === "unauthorized" },
  ],
  [
    "anonymous recipe delete gets 401",
    () => request(`/api/recipes/${UNKNOWN_RECIPE_ID}`, { method: "DELETE" }),
    { status: 401, check: (body) => body?.error === "unauthorized" },
  ],
  [
    "signup creates account",
    () => request("/api/auth/signup", { method: "POST", form: { email, password } }),
    { status: 302, location: "/auth/confirm-email" },
  ],
  [
    // With e-mail confirmation off, signup signs the user in, so the screen says the account is ready.
    "signup screen says the account is ready",
    () => request("/auth/confirm-email"),
    {
      status: 200,
      check: (body) =>
        typeof body === "string" && body.includes("Konto założone") && !body.includes("Sprawdź skrzynkę"),
    },
  ],
  [
    "signin rejects wrong password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password: "wrong" } }),
    {
      status: 302,
      location: `/auth/signin?${new URLSearchParams({ error: "invalid_credentials", email }).toString()}`,
      // The redirect keeps the e-mail but must never carry the password.
      check: (_body, location) => {
        const params = new URLSearchParams(location.split("?")[1] ?? "");
        return !params.has("password") && ![...params.values()].includes("wrong");
      },
    },
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
        typeof body?.total === "number" &&
        body.total >= 5 &&
        body.recipes.length >= 5 &&
        body.recipes.every((recipe) => recipe.steps.length > 0 && recipe.ingredients.length > 0),
    },
  ],
  [
    "signed-in user matches recipes to the pantry",
    () => request("/api/recipes/match?have=pomidor&have=chleb&exclude=jogurt"),
    {
      status: 200,
      // Shape first, then content (context/foundation/lessons.md). Every yogurt option in the seed contains "jogurt",
      // so the muffins are hidden; the other 4 seeded recipes stay, sorted by a non-increasing %.
      check: (body) => {
        if (!Array.isArray(body?.recipes) || typeof body?.hasMore !== "boolean" || body?.total !== 4) return false;
        const names = body.recipes.map((recipe) => recipe.name);
        const percents = body.recipes.map((recipe) => recipe.match?.percent);
        return (
          !names.includes("Babeczki z jogurtem naturalnym") &&
          [
            "Kanapka z serem, szynką i ogórkiem",
            "Twarożek z makrelą, porem, szpinakiem oraz ogórkiem kiszonym i pieczywem",
            "Danie jednogarnkowe z mięsem",
            "Domowe spaghetti",
          ].every((name) => names.includes(name)) &&
          percents.every((percent) => typeof percent === "number") &&
          percents.some((percent) => percent > 0) &&
          percents.every((percent, i) => i === 0 || percent <= percents[i - 1])
        );
      },
    },
  ],
  [
    "signed-in user adds a recipe",
    async () => {
      const result = await request("/api/recipes", { method: "POST", json: newRecipe() });
      if (result.status === 201 && typeof result.body?.recipe?.id === "string") addedRecipeId = result.body.recipe.id;
      return result;
    },
    {
      status: 201,
      check: (body) =>
        typeof body?.recipe?.id === "string" && body.recipe.ingredients?.[0]?.product === "jogurt naturalny",
    },
  ],
  [
    "invalid recipe is rejected",
    () => request("/api/recipes", { method: "POST", json: newRecipe({ ingredients: [] }) }),
    { status: 400, check: (body) => body?.error === "invalid_recipe" && Array.isArray(body?.issues) },
  ],
  [
    "edit page renders for the author",
    withAddedRecipe((id) => request(`/recipes/${id}/edit`)),
    { status: 200, check: (body) => typeof body === "string" && body.includes("Edytuj przepis") },
  ],
  [
    "recipe details of the added recipe offer delete",
    withAddedRecipe((id) => request(`/recipes/${id}`)),
    { status: 200, check: (body) => typeof body === "string" && body.includes("Usuń") },
  ],
  [
    "author edits the recipe",
    // The ingredient stays yogurt, so `exclude=jogurt` keeps hiding the recipe.
    withAddedRecipe((id) => request(`/api/recipes/${id}`, { method: "PUT", json: newRecipe({ name: EDITED_NAME }) })),
    {
      status: 200,
      check: (body) => body?.recipe?.id === addedRecipeId && body.recipe.name === EDITED_NAME,
    },
  ],
  [
    "invalid recipe edit is rejected",
    withAddedRecipe((id) => request(`/api/recipes/${id}`, { method: "PUT", json: newRecipe({ ingredients: [] }) })),
    { status: 400, check: (body) => body?.error === "invalid_recipe" && Array.isArray(body?.issues) },
  ],
  [
    "editing an unknown recipe gets 404",
    () => request(`/api/recipes/${UNKNOWN_RECIPE_ID}`, { method: "PUT", json: newRecipe() }),
    { status: 404, check: (body) => body?.error === "not_found" },
  ],
  [
    "author deletes the recipe",
    withAddedRecipe((id) => request(`/api/recipes/${id}`, { method: "DELETE" })),
    { status: 204, check: (body) => body === "" },
  ],
  [
    "deleted recipe details get 404",
    withAddedRecipe((id) => request(`/recipes/${id}`)),
    { status: 404, check: (body) => typeof body === "string" && body.includes("Nie znaleziono przepisu") },
  ],
  [
    "deleting the recipe again gets 404",
    withAddedRecipe((id) => request(`/api/recipes/${id}`, { method: "DELETE" })),
    { status: 404, check: (body) => body?.error === "not_found" },
  ],
  [
    "app shell renders for signed-in user",
    () => request("/"),
    { status: 200, check: (body) => typeof body === "string" && body.includes("Wyloguj") },
  ],
  [
    "app shell carries the signed-in user id",
    async () => {
      const page = await request("/");
      const id = typeof page.body === "string" ? UUID_IN_PROPS.exec(page.body)?.[1] : undefined;
      if (page.status !== 200 || id === undefined)
        return { ...page, status: page.status === 200 ? 500 : page.status, body: null };
      userId = id;
      return page;
    },
    { status: 200 },
  ],
  [
    "pantry save with another owner gets 409",
    () => request("/api/pantry", { method: "PUT", json: { ownerId: UNKNOWN_RECIPE_ID, staple: [], exclude: [] } }),
    { status: 409, check: (body) => body?.error === "owner_mismatch" },
  ],
  [
    "pantry save over the word limit gets 400",
    () => request("/api/pantry", { method: "PUT", json: { ownerId: userId, ...overWordLimitPantry } }),
    { status: 400, check: (body) => body?.error === "invalid_pantry" },
  ],
  [
    "pantry save with text/plain gets 415",
    async () => {
      const response = await fetch(BASE_URL + "/api/pantry", {
        method: "PUT",
        redirect: "manual",
        headers: { Cookie: cookieHeader(), Origin: BASE_URL, "Content-Type": "text/plain" },
        body: JSON.stringify({ ownerId: userId, staple: [], exclude: [] }),
      });
      storeCookies(response);
      const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
      const body = isJson ? await response.json() : await response.text();
      return { status: response.status, location: response.headers.get("location") ?? "", body };
    },
    { status: 415, check: (body) => body?.error === "unsupported_media_type" },
  ],
  [
    "signed-in user saves staples and exclusions",
    () =>
      request("/api/pantry", {
        method: "PUT",
        json: { ownerId: userId, staple: ["sól smoke"], exclude: ["orzechy smoke"] },
      }),
    // 204 has no body, so the helper returns an empty string.
    { status: 204, check: (body) => body === "" },
  ],
  [
    "recipe details render for a signed-in user",
    // The id comes from the list, so a failed or unexpected list shows up as a failed step.
    async () => {
      const list = await request("/api/recipes?limit=1");
      const id = list.body?.recipes?.[0]?.id;
      if (list.status !== 200 || typeof id !== "string") return { ...list, status: list.status || 500, body: null };
      return request(`/recipes/${id}`);
    },
    {
      status: 200,
      check: (body) => typeof body === "string" && body.includes("<h1") && body.includes(">Kroki<"),
    },
  ],
  [
    "unknown recipe id gets a Polish 404",
    () => request(`/recipes/${UNKNOWN_RECIPE_ID}`),
    { status: 404, check: (body) => typeof body === "string" && body.includes("Nie znaleziono przepisu") },
  ],
  [
    "malformed recipe id gets 404",
    () => request("/recipes/nie-uuid"),
    { status: 404, check: (body) => typeof body === "string" && body.includes("Nie znaleziono przepisu") },
  ],
  [
    "unknown address gets a Polish 404 with the signed-in header",
    () => request("/nie-ma-takiej-strony"),
    {
      status: 404,
      check: (body) => typeof body === "string" && body.includes("Nie znaleziono strony") && body.includes("Wyloguj"),
    },
  ],
  ["signed-in user is sent away from signin", () => request("/auth/signin"), { status: 302, location: "/" }],
  [
    "signout clears session",
    () => request("/api/auth/signout", { method: "POST" }),
    { status: 302, location: "/auth/signin" },
  ],
  [
    "signin accepts correct password again",
    () => request("/api/auth/signin", { method: "POST", form: { email, password } }),
    { status: 302, location: "/" },
  ],
  [
    "saved staples come back after signing in again",
    () => request("/"),
    {
      status: 200,
      check: (body) => {
        if (typeof body !== "string") return false;
        const html = decodeEntities(body);
        return html.includes("sól smoke") && html.includes("orzechy smoke");
      },
    },
  ],
  [
    "signout clears session again",
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
    (expected.check === undefined || expected.check(actual.body, actual.location));
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location}`);
  if (!ok) {
    failed++;
    console.log(`      expected ${expected.status} ${expected.location ?? ""}`);
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
