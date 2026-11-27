import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMe } from "../api";
import ThemeToggle from "../components/ThemeToggle";

export default function Landing() {
  const [user, setUser] = useState(null);
  const [copiedPreview, setCopiedPreview] = useState(false);

  useEffect(() => {
    getMe().then(setUser).catch(() => {}); // 401 just means "not signed in"
  }, []);

  function copySamplePrompt() {
    navigator.clipboard?.writeText(
      "Review this Express auth middleware for JWT algorithm confusion, cookie flags, and missing 401 guards."
    );
    setCopiedPreview(true);
    setTimeout(() => setCopiedPreview(false), 1800);
  }

  return (
    <main className="landing-shell">
      <nav className="glass-nav">
        <span className="logo">
          <span className="logo-icon">◈</span> AI Capsule
        </span>
        <div className="nav-actions">
          <ThemeToggle />
          {user ? (
            <Link className="btn btn-sm" to="/dashboard">Dashboard</Link>
          ) : (
            <Link className="nav-link" to="/login">Sign in</Link>
          )}
        </div>
      </nav>

      <section className="hero-grid">
        <div className="hero-content">
          <span className="eyebrow-pill">✦ Private AI Prompt Library</span>
          <h1>Keep every useful AI prompt in one place.</h1>
          <p className="lead">
            AI Capsule is a private prompt library. Save the prompts you use with ChatGPT, Copilot, Gemini or Claude,
            note what the AI answered, rate how useful it was, and improve each prompt version by version.
          </p>

          <div className="hero-cta-row">
            {user ? (
              <Link className="btn btn-lg" to="/dashboard">Open dashboard ({user.login}) →</Link>
            ) : (
              <Link className="btn btn-lg" to="/login">Sign in to get started →</Link>
            )}
            <span className="cta-hint">Free with GitHub · Private by default</span>
          </div>
        </div>

        {/* Interactive capsule showcase card */}
        <aside className="glass-card preview-card" aria-label="Example capsule preview">
          <div className="preview-header">
            <div>
              <span className="preview-kicker">Example Capsule</span>
              <h3>JWT Auth Security Audit</h3>
              <p className="project">AI Capsule Backend</p>
            </div>
            <span className="chip version">v3</span>
          </div>

          <div className="chips">
            <span className="chip">Coding</span>
            <span className="chip good">Good</span>
            <span className="chip">✓ Reviewed</span>
            <span className="chip">↑ Improved</span>
          </div>

          <div className="preview-prompt-wrap">
            <div className="prompt-bar">
              <span className="label" style={{ marginTop: 0 }}>Prompt</span>
              <button
                type="button"
                className="copy-btn"
                onClick={copySamplePrompt}
                aria-label="Copy example prompt"
              >
                {copiedPreview ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <p className="prompt-text">
              Review this Express auth middleware for JWT algorithm confusion, cookie flags, and missing 401 guards.
            </p>
          </div>

          <p className="label">Response summary</p>
          <p className="muted">Pinned HS256 verification and added HttpOnly + SameSite=Lax cookie checks.</p>
        </aside>
      </section>

      <section className="features">
        <div className="glass-card feature-card">
          <div className="feature-icon-box indigo">💾</div>
          <h3>Save &amp; Version</h3>
          <p>Store each prompt with its project, version tag, category, and response notes.</p>
        </div>
        <div className="glass-card feature-card">
          <div className="feature-icon-box emerald">🔍</div>
          <h3>Review Outcomes</h3>
          <p>Track whether the response was reviewed, improved your output, and rated useful.</p>
        </div>
        <div className="glass-card feature-card">
          <div className="feature-icon-box amber">🔒</div>
          <h3>Private by Default</h3>
          <p>Sign in with GitHub OAuth and only ever access your own isolated capsules.</p>
        </div>
      </section>

      <p className="footer-note">Built with React, Express &amp; SQLite · GitHub OAuth</p>
    </main>
  );
}
