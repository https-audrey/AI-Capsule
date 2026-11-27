# AI Capsule - Cloud-Deployed AI Prompt Manager

Assignment 3 (CSE3CWA / CSE5006, Semester 2 2026). A private prompt library: sign in with GitHub, then
create, read, update and delete your own prompt records.

## 1. Deployment

| | |
|---|---|
| **Public URL** | `https://YOUR-APP.onrender.com`  ← **replace with your real URL** |
| **Cloud platform** | Render (free Web Service) |
| **Health check** | `https://YOUR-APP.onrender.com/api/health` → `{"status":"ok"}` |
| **Source repository** | `https://github.com/YOUR-USER/YOUR-REPO` |

The React frontend and the Express API are served from the **same deployed app and URL**, so there are no CORS or
cross-origin cookie settings to configure. Free Render services sleep after inactivity, so the first request after a
pause can take about a minute.

## 2. Install and run locally

Requires Node.js 18+ (Render is pinned to Node 20 via `.node-version`).

```bash
npm install                 # backend dependencies
cp .env.example .env        # then fill in the values (never commit .env)
npm run build               # installs the client and builds the React app into client/dist
npm start                   # http://localhost:3001  (API + React app)
```

For local GitHub login, create a separate GitHub OAuth App with callback URL
`http://localhost:3001/api/auth/github/callback` and set `BASE_URL=http://localhost:3001`.

Optional hot-reload development (two terminals): `npm run dev:server` and `npm run dev:client` (React on
http://localhost:5173, proxying `/api` to Express). In that mode set `BASE_URL=http://localhost:5173` and use the callback
`http://localhost:5173/api/auth/github/callback`.

Tests: `npm test` (14 backend tests) and `npm run test:client` (11 UI tests).

**Render settings:** Build Command `npm install && npm run build` · Start Command `npm start` · Health Check Path `/api/health`.

## 3. Pages, API routes, and how React talks to Express

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Explains AI Capsule |
| `/login` | Public | Starts OAuth login ("Sign in with GitHub") |
| `/dashboard` | Protected | The user's records (the server redirects to `/login` without a valid JWT) |
| `GET /api/health` | Public | `{ "status": "ok" }` |
| `GET /api/capsules` | Protected | Read own records |
| `POST /api/capsules` | Protected | Create own record |
| `PUT /api/capsules/:id` | Protected | Update own record |
| `DELETE /api/capsules/:id` | Protected | Delete own record |
| `GET /api/auth/github`, `GET /api/auth/github/callback` | Public | OAuth start and callback |
| `GET /api/auth/me`, `POST /api/auth/logout` | `me` protected | Current user / sign out |

React calls these with `fetch` (`client/src/api.js`) on the same origin. The browser attaches the `token` cookie
automatically; there is no `localStorage` and no `Authorization: Bearer` header. A `401` from any call sends the user to `/login`.

## 4. OAuth provider and the application JWT

**Provider: GitHub OAuth** (the recommended option; no fallback was needed).

1. `/login` → "Sign in with GitHub" → `GET /api/auth/github`. Express creates a random `state`, stores it in a short-lived
   HttpOnly cookie and redirects to GitHub.
2. GitHub redirects to `GET /api/auth/github/callback?code=...&state=...`. Express checks `state` matches its cookie
   (anti-CSRF), exchanges the `code` for a GitHub access token **on the server** using the client secret, and reads the
   GitHub user's numeric `id` and `login`. The GitHub token is then discarded - it is never stored or sent to the browser.
3. **Express issues its own application JWT** (`jsonwebtoken`, HS256, signed with `JWT_SECRET`, payload `sub` = GitHub user id,
   `login`, expires in 1 day).
4. The JWT is stored in a cookie named **`token`** with `HttpOnly` (JavaScript cannot read it), `Secure` (HTTPS only in
   production), `SameSite=Lax`, `Path=/`.
5. **Verification:** `requireAuth` middleware (`server/auth.js`) reads the cookie, calls `jwt.verify` with the algorithm pinned
   to HS256, and sets `req.user` from the verified payload. Missing, malformed, forged, wrong-algorithm or expired tokens
   return **401 Unauthorized**. `server/capsules.js` calls `router.use(requireAuth)`, so GET, POST, PUT and DELETE are all protected.
6. **Ownership:** `user_id` is `req.user.id` (from the verified JWT). Any `user_id` sent by the browser is ignored, and every
   query includes `AND user_id = ?`. Another user's record id returns 404 (it is not revealed to exist).

## 5. Environment variables (names only)

| Name | Purpose |
|---|---|
| `JWT_SECRET` | Signs/verifies the application JWT (the server refuses to start without it) |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client id |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret |
| `BASE_URL` | Public URL of the app (used to build the OAuth callback URL) |
| `NODE_ENV` | `production` on Render (turns on the `Secure` cookie flag) |
| `NODE_VERSION` | Render only: `20` |
| `PORT` | Provided by Render automatically |
| `DB_PATH` | Optional SQLite file path (default `server/data/capsules.db`) |

No secret values are in the repository: `.env` is git-ignored and only `.env.example` (names, no values) is committed.

## 6. Database, ownership and persistence

- **SQLite** via `better-sqlite3`. `server/schema.sql` (the `capsules` table from the brief plus an index on `user_id`) is
  applied automatically by `server/db.js` every time the server starts (`CREATE TABLE IF NOT EXISTS`), so there is no manual setup step.
- **Ownership:** each row has `user_id` (the GitHub user id from the verified JWT). Nothing about a record's owner is accepted from the client.
- **Storage is EPHEMERAL on Render's free tier.** The local filesystem is temporary, so the database file can be lost when the
  service restarts or redeploys. Data survives normal use while the service is running.

## 7. Required cURL checks and results

```bash
# Health
curl -i https://YOUR-APP.onrender.com/api/health
# Test 1 - no authentication
curl -i https://YOUR-APP.onrender.com/api/capsules
# Test 2 - fake / invalid JWT
curl -i -H "Cookie: token=fake-token-123" https://YOUR-APP.onrender.com/api/capsules
```

**Results from the deployed app:** `[PASTE YOUR REAL OUTPUT HERE after deploying - run ./scripts/curl-tests.sh https://YOUR-APP.onrender.com]`

For reference, the same commands run against the production build locally returned:

| Check | Status | Body |
|---|---|---|
| `GET /api/health` | `200 OK` | `{"status":"ok"}` |
| Test 1 (no cookie) | `401 Unauthorized` | `{"error":"Unauthorized"}` |
| Test 2 (`token=fake-token-123`) | `401 Unauthorized` | `{"error":"Unauthorized"}` |

## 8. How it was verified

- **OAuth + JWT + protected API:** backend tests run the real login flow against a fake GitHub server and check that the callback
  rejects a wrong/missing `state` and a bad code; that a successful login sets a `token` cookie that is `HttpOnly`, `Secure` and
  `SameSite=Lax`, whose value is our JWT (not the GitHub token); and that GET/POST/PUT/DELETE on `/api/capsules` return 401 with no
  cookie, `token=fake-token-123`, a token signed with another secret, an `alg: none` token, an expired token and an HS512 token.
  I also ran the two required cURL commands against a local production build, and will repeat them against the deployed URL.
- **CRUD and ownership:** tests create, read, update and delete a record; send a forged `user_id` in the body and confirm the stored
  owner is still the JWT's user; sign in as two different users and confirm user B sees only B's records and gets 404 when
  trying to update or delete user A's record, while A's record stays unchanged. In the deployed app I performed CREATE, READ,
  UPDATE and DELETE through the UI after GitHub login (shown in the video).

## 9. AI-assisted development statement

- **AI tool used:** Claude (Anthropic) - project scaffolding, Express routes, OAuth/JWT code, React components, CSS, tests and the deployment guide.
- **A problem I found and corrected in AI-generated code or configuration:**
  `[WRITE YOUR OWN, TRUTHFULLY - something that really went wrong for you and how you fixed it. Deployment usually produces
  one, e.g. GitHub showing "redirect_uri is not associated with this application" because the callback URL did not exactly match
  the Render URL, the build failing on the wrong Node version, or the cookie not being set until NODE_ENV/BASE_URL was configured.]`
- **How I verified OAuth, JWT and protected behaviour, CRUD and ownership:** see section 8 - `[add what YOU personally ran or checked]`.
- **One decision I made myself and can explain:** `[WRITE YOUR OWN - e.g. serving React and Express from one Render service
  to avoid CORS and cross-site cookies; returning 404 instead of 403 for another user's record; keeping SQLite and documenting the
  ephemeral-storage limitation; or using an HttpOnly cookie instead of localStorage.]`

## 10. Limitation

On Render's free tier SQLite data is **not persistent**: it can disappear when the service restarts or is redeployed, and a
sleeping service takes about a minute to wake up. A production version would use a managed database such as Render PostgreSQL.

## Project structure

```
server/   index.js  auth.js  capsules.js  db.js  schema.sql  test/api.test.js
client/   src/App.jsx  src/api.js  src/pages/{Landing,Login,Dashboard}.jsx
          src/components/{CapsuleForm,CapsuleCard}.jsx  src/test/
scripts/  curl-tests.sh        render.yaml   .env.example   DEPLOY_GUIDE.md
```
