# Deploy guide (Render + GitHub OAuth)

I cannot deploy for you - it needs your own GitHub and Render accounts. Plan ~45 minutes. Render's screens and free-tier
rules change, so check the current labels and limits on Render's site as you go.

## 0. Before you start
- Run `npm install && cp .env.example .env`, fill `.env`, `npm run build`, `npm start`, and confirm it works locally first
  (needs a local GitHub OAuth App, see README section 2).
- Check that `.env` is NOT committed: `git status` must not list it.

## 1. Push to GitHub
Create a repository (private is fine) and push everything. Never commit `.env`. Do not put secrets in the README.

## 2. Choose the app name, then create the Render service
The URL is `https://<service-name>.onrender.com`, so pick the name first (e.g. `ai-capsule-yourname`).
1. Render dashboard → **New** → **Web Service** → connect your GitHub repo.
2. Name: your chosen name · Runtime: **Node** · Instance type: **Free**.
3. Build Command: `npm install && npm run build` · Start Command: `npm start`.
4. Under Advanced, set Health Check Path to `/api/health`.
(`render.yaml` in the repo holds the same settings if you prefer a Blueprint.)

## 3. Create the GitHub OAuth App (production)
GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App**
- Homepage URL: `https://<service-name>.onrender.com`
- Authorization callback URL: `https://<service-name>.onrender.com/api/auth/github/callback` (must match exactly)
Copy the Client ID, then **Generate a new client secret** and copy it. A GitHub OAuth App allows only one callback URL, so
keep a second OAuth App for localhost.

## 4. Set environment variables on Render (Environment tab)
| Name | Value |
|---|---|
| `NODE_VERSION` | `20` |
| `NODE_ENV` | `production` |
| `BASE_URL` | `https://<service-name>.onrender.com` |
| `GITHUB_CLIENT_ID` | from step 3 |
| `GITHUB_CLIENT_SECRET` | from step 3 |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
Save; Render redeploys. Wait until the deploy shows **Live**.

## 5. Verify on the public URL
1. Open `https://<service-name>.onrender.com/api/health` → `{"status":"ok"}`.
2. `./scripts/curl-tests.sh https://<service-name>.onrender.com` → both tests must show **401 Unauthorized**.
3. Open the site → Sign in with GitHub → you land on `/dashboard`. Create, edit and delete a record.
4. Paste the real cURL output into README section 7, fill in the three `[WRITE YOUR OWN]` spots, and add your real URLs.

## 6. Record the video (3-5 min, MP4, working audio) - everything in Section 13 must be visible
1. Browser at the deployed URL (not localhost) → `/api/health` showing `{"status":"ok"}`.
2. Terminal: cURL Test 1 → 401; cURL Test 2 (`token=fake-token-123`) → 401.
3. Sign in with GitHub → dashboard.
4. CREATE → READ (list) → UPDATE → DELETE a record.
5. Render dashboard: service settings and the environment-variable **names** (hide the values; do not click "reveal").
6. Say briefly: SQLite on Render free is ephemeral (data can reset on restart/redeploy), plus one deployment issue you hit.
**Tip:** free services sleep - open `/api/health` a minute before recording. Create your demo records after the final deploy, because a redeploy can wipe the database.

## 7. Submit
ZIP (no `node_modules`, `client/dist` or `.env`) + MP4 straight to the LMS. Keep the Render service running until marking is finished.

## Troubleshooting
| Symptom | Likely cause / fix |
|---|---|
| GitHub: "redirect_uri is not associated with this application" | Callback URL in the OAuth App differs from `BASE_URL + /api/auth/github/callback` (check https, spelling, no trailing slash) |
| Login bounces back to `/login?error=oauth_failed` | Wrong `GITHUB_CLIENT_SECRET`, or the OAuth App is the localhost one; check Render logs |
| Signed in but dashboard returns to `/login` | Cookie not stored: make sure you use the `https://` URL; `JWT_SECRET` must not change between login and use |
| `GitHub OAuth is not configured` | `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` not set on Render |
| Build fails on `better-sqlite3` | Set `NODE_VERSION=20` and redeploy |
| Records vanished | Ephemeral SQLite after a restart/redeploy (documented limitation) |
