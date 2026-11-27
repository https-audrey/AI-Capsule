// Backend tests: npm test
// A fake GitHub (token + user endpoints) lets us exercise the REAL OAuth -> JWT -> CRUD flow
// without touching github.com. Uses a throw-away SQLite file.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const jwt = require("jsonwebtoken");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "capsule-"));
fs.writeFileSync(path.join(tmp, "index.html"), "<html><body><div id='root'></div></body></html>");
const SECRET = "test-secret-which-is-long-enough";
Object.assign(process.env, {
  DB_PATH: path.join(tmp, "test.db"), CLIENT_DIST: tmp, JWT_SECRET: SECRET, COOKIE_SECURE: "true",
  BASE_URL: "https://capsule.example.test", GITHUB_CLIENT_ID: "client-id-123", GITHUB_CLIENT_SECRET: "client-secret-xyz",
});
delete process.env.NODE_ENV;

const app = require("../index");
const USERS = { alice: { id: 1001, login: "alice" }, bob: { id: 2002, login: "bob" } };

let server, fakeGithub, base;
before(async () => {
  fakeGithub = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      if (req.method === "POST" && req.url === "/login/oauth/access_token") {
        const { code } = JSON.parse(body);
        return res.end(JSON.stringify(USERS[code] ? { access_token: `gh-token-for-${code}` } : { error: "bad_verification_code" }));
      }
      if (req.url === "/user") {
        const user = USERS[(req.headers.authorization || "").replace("Bearer gh-token-for-", "")];
        res.statusCode = user ? 200 : 401;
        return res.end(JSON.stringify(user || { message: "Bad credentials" }));
      }
      res.statusCode = 404; return res.end("{}");
    });
  });
  await new Promise((r) => fakeGithub.listen(0, "127.0.0.1", r));
  process.env.GITHUB_TOKEN_URL = `http://127.0.0.1:${fakeGithub.address().port}/login/oauth/access_token`;
  process.env.GITHUB_USER_URL = `http://127.0.0.1:${fakeGithub.address().port}/user`;
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://localhost:${server.address().port}`;
});
after(() => { server.close(); fakeGithub.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

const cookieFrom = (setCookies, name) => setCookies.find((c) => c.startsWith(`${name}=`));
async function login(code) {
  const start = await fetch(`${base}/api/auth/github`, { redirect: "manual" });
  const state = new URL(start.headers.get("location")).searchParams.get("state");
  const stateCookie = cookieFrom(start.headers.getSetCookie(), "oauth_state").split(";")[0];
  const cb = await fetch(`${base}/api/auth/github/callback?code=${code}&state=${state}`, { redirect: "manual", headers: { Cookie: stateCookie } });
  const raw = cookieFrom(cb.headers.getSetCookie(), "token");
  return { res: cb, raw, cookie: raw ? raw.split(";")[0] : undefined };
}
const api = async (method, url, { cookie, body } = {}) => {
  const res = await fetch(base + url, {
    method, redirect: "manual",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: json, text, res };
};
const good = { project_name: "SmartFarm Irrigation", prompt_title: "Debug cloud deployment", prompt_version: "v1", prompt_text: "Why does my Node server fail?",
  response_summary: "Check start command", category: "Coding", usefulness: "Good", reviewed: true, improved: false, screenshot_url: "https://example.com/shot.png", notes: "Tested and worked" };

test("GET /api/health is public and returns { status: 'ok' }", async () => {
  const r = await api("GET", "/api/health");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { status: "ok" });
});

test("cURL Test 1: no authentication -> 401 and no capsule data", async () => {
  const r = await api("GET", "/api/capsules");
  assert.equal(r.status, 401);
  assert.deepEqual(r.body, { error: "Unauthorized" });
});

test("cURL Test 2: fake JWT (token=fake-token-123) -> 401 on GET, POST, PUT and DELETE", async () => {
  const cookie = "token=fake-token-123";
  for (const [m, u] of [["GET", "/api/capsules"], ["POST", "/api/capsules"], ["PUT", "/api/capsules/1"], ["DELETE", "/api/capsules/1"]]) {
    const r = await api(m, u, { cookie, body: m === "POST" || m === "PUT" ? good : undefined });
    assert.equal(r.status, 401, `${m} ${u}`);
  }
  for (const [m, u] of [["POST", "/api/capsules"], ["PUT", "/api/capsules/1"], ["DELETE", "/api/capsules/1"]]) {
    assert.equal((await api(m, u, { body: good })).status, 401, `no cookie ${m}`);
  }
});

test("forged / expired / wrong-algorithm tokens are rejected (the JWT is really verified)", async () => {
  const forged = {
    "signed with another secret": jwt.sign({ sub: "1001" }, "some-other-secret", { algorithm: "HS256" }),
    "alg none": `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from('{"sub":"1001"}').toString("base64url")}.`,
    "expired": jwt.sign({ sub: "1001" }, SECRET, { algorithm: "HS256", expiresIn: -10 }),
    "no subject": jwt.sign({ login: "x" }, SECRET, { algorithm: "HS256" }),
    "wrong algorithm (HS512)": jwt.sign({ sub: "1001" }, SECRET, { algorithm: "HS512" }),
  };
  for (const [name, token] of Object.entries(forged)) {
    const r = await api("GET", "/api/capsules", { cookie: `token=${token}` });
    assert.equal(r.status, 401, name);
  }
});

test("OAuth start redirects to GitHub with client_id, redirect_uri and a state cookie", async () => {
  const r = await fetch(`${base}/api/auth/github`, { redirect: "manual" });
  assert.equal(r.status, 302);
  const loc = new URL(r.headers.get("location"));
  assert.equal(loc.origin + loc.pathname, "https://github.com/login/oauth/authorize");
  assert.equal(loc.searchParams.get("client_id"), "client-id-123");
  assert.equal(loc.searchParams.get("redirect_uri"), "https://capsule.example.test/api/auth/github/callback");
  const state = cookieFrom(r.headers.getSetCookie(), "oauth_state");
  assert.ok(state.includes(loc.searchParams.get("state")) && /HttpOnly/i.test(state));
});

test("OAuth callback rejects a bad/missing state or a bad code and sets no token", async () => {
  const start = await fetch(`${base}/api/auth/github`, { redirect: "manual" });
  const stateCookie = cookieFrom(start.headers.getSetCookie(), "oauth_state").split(";")[0];
  const attempts = [
    fetch(`${base}/api/auth/github/callback?code=alice&state=wrong`, { redirect: "manual", headers: { Cookie: stateCookie } }),
    fetch(`${base}/api/auth/github/callback?code=alice&state=abc`, { redirect: "manual" }),
    fetch(`${base}/api/auth/github/callback?code=alice`, { redirect: "manual", headers: { Cookie: stateCookie } }),
  ];
  for (const r of await Promise.all(attempts)) {
    assert.equal(r.status, 302);
    assert.equal(r.headers.get("location"), "/login?error=oauth_failed");
    assert.equal(cookieFrom(r.headers.getSetCookie(), "token"), undefined);
  }
  const bad = await login("nobody"); // GitHub rejects the code
  assert.equal(bad.res.headers.get("location"), "/login?error=oauth_failed");
  assert.equal(bad.raw, undefined);
});

test("successful login: Express issues its OWN JWT in a Secure, HttpOnly cookie named token", async () => {
  const { res, raw, cookie } = await login("alice");
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "/dashboard");
  assert.match(raw, /^token=/);
  assert.match(raw, /HttpOnly/i);
  assert.match(raw, /Secure/i);
  assert.match(raw, /SameSite=Lax/i);
  const value = cookie.slice("token=".length);
  assert.ok(!value.includes("gh-token"), "must not be the GitHub token");
  const payload = jwt.verify(value, SECRET, { algorithms: ["HS256"] });
  assert.equal(payload.sub, "1001"); // GitHub user id
  assert.ok(payload.exp > payload.iat);
  const me = await api("GET", "/api/auth/me", { cookie });
  assert.deepEqual(me.body, { id: "1001", login: "alice" });
});

test("logout clears the cookie", async () => {
  const { cookie } = await login("alice");
  const r = await api("POST", "/api/auth/logout", { cookie });
  assert.equal(r.status, 200);
  assert.match(cookieFrom(r.res.headers.getSetCookie(), "token"), /^token=;/);
});

test("full CRUD for a signed-in user; user_id comes from the JWT, never the body", async () => {
  const { cookie } = await login("alice");
  assert.deepEqual((await api("GET", "/api/capsules", { cookie })).body, []);

  const created = await api("POST", "/api/capsules", { cookie, body: { ...good, user_id: "hacker-999", id: 77, created_at: "1999-01-01" } });
  assert.equal(created.status, 201);
  assert.equal(created.body.user_id, "1001");
  assert.notEqual(created.body.id, 77);
  assert.equal(created.body.reviewed, 1);
  assert.equal(created.body.improved, 0);
  assert.ok(created.body.created_at.startsWith("20"));
  const id = created.body.id;

  const list = await api("GET", "/api/capsules", { cookie });
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].prompt_title, "Debug cloud deployment");

  const updated = await api("PUT", `/api/capsules/${id}`, { cookie, body: { prompt_version: "v2", improved: "Yes", user_id: "hacker-999", notes: "Improved" } });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.prompt_version, "v2");
  assert.equal(updated.body.improved, 1);
  assert.equal(updated.body.project_name, "SmartFarm Irrigation"); // omitted fields kept
  assert.equal(updated.body.user_id, "1001");

  const del = await api("DELETE", `/api/capsules/${id}`, { cookie });
  assert.deepEqual(del.body, { deleted: true, id });
  assert.deepEqual((await api("GET", "/api/capsules", { cookie })).body, []);
  assert.equal((await api("DELETE", `/api/capsules/${id}`, { cookie })).status, 404);
});

test("ownership: Bob cannot read, update or delete Alice's record", async () => {
  const alice = (await login("alice")).cookie;
  const bob = (await login("bob")).cookie;
  const id = (await api("POST", "/api/capsules", { cookie: alice, body: good })).body.id;
  await api("POST", "/api/capsules", { cookie: bob, body: { ...good, prompt_title: "Bob's prompt" } });

  const bobList = (await api("GET", "/api/capsules", { cookie: bob })).body;
  assert.equal(bobList.length, 1);
  assert.equal(bobList[0].prompt_title, "Bob's prompt");
  assert.ok(bobList.every((c) => c.user_id === "2002"));

  assert.equal((await api("PUT", `/api/capsules/${id}`, { cookie: bob, body: { notes: "pwned" } })).status, 404);
  assert.equal((await api("DELETE", `/api/capsules/${id}`, { cookie: bob })).status, 404);

  const aliceList = (await api("GET", "/api/capsules", { cookie: alice })).body;
  assert.equal(aliceList.length, 1);
  assert.equal(aliceList[0].notes, "Tested and worked"); // untouched
});

test("validation returns 400 with { error } and never a 500", async () => {
  const { cookie } = await login("alice");
  const cases = [
    [{ ...good, project_name: "" }, "project_name is required"],
    [{ ...good, prompt_title: undefined }, "prompt_title is required"],
    [{ ...good, prompt_text: "   " }, "prompt_text is required"],
    [{ ...good, project_name: 42 }, "project_name must be a string"],
    [{ ...good, notes: "n".repeat(5001) }, "notes must be 5000 characters or fewer"],
    [{ ...good, screenshot_url: "javascript:alert(1)" }, "screenshot_url must be a valid http(s) URL"],
    [{ ...good, screenshot_url: "not a url" }, "screenshot_url must be a valid http(s) URL"],
    [{ ...good, reviewed: "maybe" }, "reviewed must be Yes/No (true/false)"],
  ];
  for (const [body, message] of cases) {
    const r = await api("POST", "/api/capsules", { cookie, body });
    assert.equal(r.status, 400, message);
    assert.deepEqual(r.body, { error: message });
  }
  const badJson = await fetch(`${base}/api/capsules`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: "{oops" });
  assert.equal(badJson.status, 400);
  assert.equal((await api("POST", "/api/capsules", { cookie, body: [1] })).status, 400);
  assert.equal((await api("PUT", "/api/capsules/abc", { cookie, body: good })).status, 404);
});

test("optional fields may be omitted", async () => {
  const { cookie } = await login("alice");
  const r = await api("POST", "/api/capsules", { cookie, body: { project_name: "P", prompt_title: "T", prompt_text: "X" } });
  assert.equal(r.status, 201);
  assert.equal(r.body.reviewed, 0);
  assert.equal(r.body.prompt_version, "");
});

test("the protected dashboard page redirects to /login without a valid JWT", async () => {
  for (const cookie of [undefined, "token=fake-token-123"]) {
    const r = await fetch(`${base}/dashboard`, { redirect: "manual", headers: cookie ? { Cookie: cookie } : {} });
    assert.equal(r.status, 302);
    assert.equal(r.headers.get("location"), "/login");
  }
  const { cookie } = await login("alice");
  const ok = await fetch(`${base}/dashboard`, { redirect: "manual", headers: { Cookie: cookie } });
  assert.equal(ok.status, 200);
  assert.ok((await ok.text()).includes("root"));
});

test("public pages and unknown API paths behave", async () => {
  for (const p of ["/", "/login"]) assert.equal((await fetch(base + p)).status, 200);
  const r = await api("GET", "/api/nope");
  assert.equal(r.status, 404);
  assert.deepEqual(r.body, { error: "Not found" });
});
