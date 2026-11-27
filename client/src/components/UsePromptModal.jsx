import { useMemo, useState } from "react";
import { estimateTokens, extractVariables, fillVariables } from "../templates";

export default function UsePromptModal({ capsule, onClose }) {
  const variables = useMemo(() => extractVariables(capsule.prompt_text), [capsule.prompt_text]);
  const [values, setValues] = useState({});
  const [copied, setCopied] = useState(false);

  const rendered = useMemo(
    () => fillVariables(capsule.prompt_text, values),
    [capsule.prompt_text, values]
  );

  const tokens = estimateTokens(rendered);

  function handleCopy() {
    navigator.clipboard?.writeText(rendered);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal use-modal" role="dialog" aria-modal="true" aria-label={`Use prompt: ${capsule.prompt_title}`}>
        <div className="use-modal-header">
          <div>
            <span className="preview-kicker">{capsule.project_name}</span>
            <h2>{capsule.prompt_title}</h2>
          </div>
          {capsule.prompt_version && <span className="chip version">{capsule.prompt_version}</span>}
        </div>

        {variables.length > 0 ? (
          <div className="var-grid">
            <p className="var-hint">
              Fill in the <strong>{variables.length}</strong> template {variables.length === 1 ? "variable" : "variables"} below to build a ready-to-paste prompt:
            </p>
            {variables.map((v) => (
              <div className="field" key={v}>
                <label>
                  <code>{`{{${v}}}`}</code>
                  <textarea
                    rows={v.includes("code") || v.includes("draft") || v.includes("error") ? 3 : 1}
                    value={values[v] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
                    placeholder={`Enter ${v}...`}
                  />
                </label>
              </div>
            ))}
          </div>
        ) : (
          <p className="var-hint">
            Tip: Add <code>{`{{placeholders}}`}</code> in your prompt text to make reusable variables here.
          </p>
        )}

        <div className="prompt-bar" style={{ marginTop: ".75rem" }}>
          <span className="label" style={{ marginTop: 0 }}>Ready prompt</span>
          <span className="muted">~{tokens} tokens · {rendered.length} chars</span>
        </div>
        <pre className="prompt-text use-preview">{rendered}</pre>

        {capsule.response_summary && (
          <>
            <p className="label">Previous response summary</p>
            <p className="card-body-text">{capsule.response_summary}</p>
          </>
        )}

        <div className="button-row" style={{ marginTop: "1.1rem" }}>
          <button type="button" onClick={handleCopy}>
            {copied ? "Copied ready prompt ✓" : "Copy ready prompt"}
          </button>
          <button type="button" className="secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
