import { Link, useSearchParams } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";

export default function Login() {
  const [params] = useSearchParams();
  const failed = params.get("error") === "oauth_failed";

  return (
    <main className="auth-shell">
      <div className="auth-topbar">
        <Link to="/" className="logo">
          <span className="logo-icon">◈</span> AI Capsule
        </Link>
        <ThemeToggle />
      </div>

      <section className="glass-card auth-card">
        <div className="auth-emblem" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 22V12m0 0l9-5m-9 5L3 7" />
          </svg>
        </div>

        <span className="eyebrow-pill">Private Workspace</span>
        <h1>Sign in</h1>
        <p className="lead">
          AI Capsule uses GitHub to know who you are. We only read your public GitHub id and username.
        </p>

        {failed && (
          <div className="banner error" role="alert">
            GitHub sign-in did not complete. Please try again.
          </div>
        )}

        {/* A normal link (full page navigation): Express redirects the browser to GitHub. */}
        <a className="btn btn-github btn-full" href="/api/auth/github">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          Sign in with GitHub
        </a>

        <div className="trust-pills" aria-hidden="true">
          <span>🔒 HttpOnly JWT</span>
          <span>•</span>
          <span>Read-only profile</span>
          <span>•</span>
          <span>Isolated data</span>
        </div>

        <div className="auth-footer">
          <Link to="/" className="back-link">← Back to home</Link>
        </div>
      </section>
    </main>
  );
}
