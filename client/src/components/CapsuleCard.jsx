import { useState } from "react";
import { estimateTokens, extractVariables } from "../templates";

const yesNo = (v) => (v ? "Yes" : "No");

export default function CapsuleCard({ capsule: c, onEdit, onDelete, onUse, onNewVersion, onToggleFlag }) {
  const [copied, setCopied] = useState(false);
  const vars = extractVariables(c.prompt_text);
  const tokens = estimateTokens(c.prompt_text);

  function copyPrompt() {
    navigator.clipboard?.writeText(c.prompt_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <article className="glass-card card" data-testid={`capsule-${c.id}`}>
      <header>
        <div>
          <h3>{c.prompt_title}</h3>
          <p className="project">{c.project_name}</p>
        </div>
        {c.prompt_version && <span className="chip version">{c.prompt_version}</span>}
      </header>

      <div className="chips">
        {c.category && <span className="chip">{c.category}</span>}
        {c.usefulness && <span className={`chip ${c.usefulness === "Good" ? "good" : "warn"}`}>{c.usefulness}</span>}
        <button
          type="button"
          className={`chip chip-toggle ${c.reviewed ? "good" : ""}`}
          onClick={() => onToggleFlag?.(c, "reviewed")}
          title="Click to toggle Reviewed status"
        >
          Reviewed: {yesNo(c.reviewed)}
        </button>
        <button
          type="button"
          className={`chip chip-toggle ${c.improved ? "good" : ""}`}
          onClick={() => onToggleFlag?.(c, "improved")}
          title="Click to toggle Improved status"
        >
          Improved: {yesNo(c.improved)}
        </button>
      </div>

      <div className="prompt-bar" style={{ marginTop: ".8rem" }}>
        <p className="label" style={{ marginTop: 0 }}>
          Prompt <span className="token-tag">~{tokens} tok</span>
        </p>
        <div className="prompt-actions">
          {vars.length > 0 && (
            <button type="button" className="copy-btn accent" onClick={() => onUse?.(c)}>
              Fill {vars.length} {vars.length === 1 ? "var" : "vars"}
            </button>
          )}
          <button type="button" className="copy-btn" onClick={copyPrompt}>
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      </div>
      <p className="prompt-text">{c.prompt_text}</p>

      {c.response_summary && (<><p className="label">Response summary</p><p className="card-body-text">{c.response_summary}</p></>)}
      {c.notes && (<><p className="label">Notes</p><p className="card-body-text">{c.notes}</p></>)}
      {c.screenshot_url && (
        <p style={{ marginTop: ".55rem" }}>
          <a href={c.screenshot_url} target="_blank" rel="noopener noreferrer" className="evidence-link">
            Screenshot evidence ↗
          </a>
        </p>
      )}

      <footer>
        <span className="muted">Created {c.created_at}</span>
        <div className="button-row">
          <button type="button" className="secondary btn-sm" onClick={() => onUse?.(c)}>Use</button>
          <button type="button" className="secondary btn-sm" onClick={() => onNewVersion?.(c)}>New version</button>
          <button type="button" className="secondary btn-sm" onClick={() => onEdit(c)}>Edit</button>
          <button type="button" className="danger btn-sm" onClick={() => onDelete(c)}>Delete</button>
        </div>
      </footer>
    </article>
  );
}
