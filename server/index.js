// index.js - one Express app serves BOTH the API and the built React frontend,
// so there is a single public URL and no CORS / cross-origin cookie problems.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");

const { router: authRouter, verifyToken, COOKIE_NAME } = require("./auth");
const capsulesRouter = require("./capsules");

const app = express();
app.set("trust proxy", 1); // Render / Azure terminate HTTPS in front of Express
app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// ---- API ----
app.get("/api/health", (req, res) => res.json({ status: "ok" })); // public
app.use("/api/auth", authRouter); //                               OAuth login / callback / me / logout
app.use("/api/capsules", capsulesRouter); //                       protected by requireAuth inside the router
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// ---- Frontend (React build) ----
const DIST = process.env.CLIENT_DIST || path.join(__dirname, "..", "client", "dist");
const indexHtml = path.join(DIST, "index.html");

// The protected dashboard is not even served to a visitor without a valid JWT.
function dashboardGuard(req, res, next) {
  try {
    verifyToken(req.cookies[COOKIE_NAME]);
    return next();
  } catch {
    return res.redirect("/login");
  }
}
app.get(["/dashboard", "/dashboard/*"], dashboardGuard, (req, res) => res.sendFile(indexHtml));
app.use(express.static(DIST));
app.get("*", (req, res) => {
  if (!fs.existsSync(indexHtml)) return res.status(503).send("Frontend not built. Run: npm run build");
  return res.sendFile(indexHtml);
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Request body is not valid JSON" });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Request body too large" });
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
});

if (require.main === module) {
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not set. Set it in .env (local) or the hosting platform's environment variables.");
    process.exit(1);
  }
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    console.warn("Warning: GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET not set - GitHub login will not work.");
  }
  const port = process.env.PORT || 3001;
  app.listen(port, () => console.log(`AI Capsule listening on port ${port}`));
}

module.exports = app;
