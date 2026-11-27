// auth.js - GitHub OAuth login, application JWT issuing, and JWT verification middleware.
//
// Flow: /api/auth/github -> GitHub -> /api/auth/github/callback -> Express verifies the
// `state`, exchanges the code, reads the GitHub user id, then signs ITS OWN application
// JWT and stores it in a Secure, HttpOnly cookie named `token`. The GitHub access token
// is used once to read the profile and then discarded - it is never stored or returned.
const crypto = require("crypto");
const express = require("express");
const jwt = require("jsonwebtoken");

const COOKIE_NAME = "token";
const STATE_COOKIE = "oauth_state";
const TOKEN_TTL_SECONDS = 24 * 60 * 60; // 1 day

// Read at call time so tests and hosting platforms can set them before first use.
function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET environment variable is not set");
  return s;
}
const isSecure = () => process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true";
const cookieBase = () => ({ httpOnly: true, secure: isSecure(), sameSite: "lax", path: "/" });
const githubUrls = () => ({
  authorize: process.env.GITHUB_AUTHORIZE_URL || "https://github.com/login/oauth/authorize",
  token: process.env.GITHUB_TOKEN_URL || "https://github.com/login/oauth/access_token",
  user: process.env.GITHUB_USER_URL || "https://api.github.com/user",
});
const baseUrl = (req) =>
  (process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");

function signToken(user) {
  return jwt.sign({ sub: String(user.id), login: user.login }, jwtSecret(), {
    algorithm: "HS256",
    expiresIn: TOKEN_TTL_SECONDS,
  });
}

// Throws if the token is missing, malformed, expired, or not signed with our secret.
// `algorithms` is pinned so "alg: none" and other tricks are rejected.
function verifyToken(token) {
  return jwt.verify(token, jwtSecret(), { algorithms: ["HS256"] });
}

// JWT authentication middleware. Every /api/capsules route goes through this.
// The authenticated user comes ONLY from the verified token, never from the request body.
function requireAuth(req, res, next) {
  const secret = jwtSecret(); // a missing secret is a server error (500), not a silent 401
  void secret;
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = verifyToken(token);
    if (!payload.sub) return res.status(401).json({ error: "Unauthorized" });
    req.user = { id: String(payload.sub), login: payload.login };
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

const router = express.Router();

// Step 1: send the browser to GitHub with a random anti-CSRF `state`.
router.get("/github", (req, res) => {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    return res.status(500).json({ error: "GitHub OAuth is not configured on the server" });
  }
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie(STATE_COOKIE, state, { ...cookieBase(), maxAge: 10 * 60 * 1000 });
  const url = new URL(githubUrls().authorize);
  url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${baseUrl(req)}/api/auth/github/callback`);
  url.searchParams.set("state", state);
  res.redirect(url.toString());
});

// Step 2: GitHub sends the user back here with ?code=...&state=...
router.get("/github/callback", async (req, res) => {
  const { code, state } = req.query;
  const expected = req.cookies[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, cookieBase());
  const fail = () => res.redirect("/login?error=oauth_failed");

  if (typeof code !== "string" || typeof state !== "string" || !expected || state !== expected) return fail();

  try {
    const urls = githubUrls();
    const tokenRes = await fetch(urls.token, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${baseUrl(req)}/api/auth/github/callback`,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error(`GitHub token exchange failed: ${tokenData.error || tokenRes.status}`);

    const userRes = await fetch(urls.user, {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/json", "User-Agent": "ai-capsule" },
    });
    const ghUser = await userRes.json();
    if (!userRes.ok || !ghUser.id) throw new Error("Could not read the GitHub user profile");

    // Our own application JWT. user_id = the GitHub user id.
    res.cookie(COOKIE_NAME, signToken({ id: ghUser.id, login: ghUser.login }), {
      ...cookieBase(),
      maxAge: TOKEN_TTL_SECONDS * 1000,
    });
    return res.redirect("/dashboard");
  } catch (err) {
    console.error("OAuth callback error:", err.message);
    return fail();
  }
});

// Who am I? Used by the React app to show the signed-in user (401 when not logged in).
router.get("/me", requireAuth, (req, res) => res.json({ id: req.user.id, login: req.user.login }));

router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieBase());
  res.json({ ok: true });
});

module.exports = { router, requireAuth, verifyToken, signToken, COOKIE_NAME };
