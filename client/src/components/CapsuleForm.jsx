import { useState } from "react";
import { STARTER_TEMPLATES, estimateTokens, extractVariables } from "../templates";

const CATEGORIES = ["Coding", "Writing", "Research", "Study", "Other"];
const USEFULNESS = ["Good", "Needs Improvement"];

function validate(f) {
  const errors = {};
  if (!f.project_name.trim()) errors.project_name = "Project name is required.";
  if (!f.prompt_title.trim()) errors.prompt_title = "Prompt title is required.";
  if (!f.prompt_text.trim()) errors.prompt_text = "Prompt text is required.";
  if (f.screenshot_url.trim()) {
    try {
      if (!["http:", "https:"].includes(new URL(f.screenshot_url.trim()).protocol)) throw new Error();
    } catch {
      errors.screenshot_url = "Enter a valid http(s) link.";
    }
  }
  return errors;
}

function Field({ label, error, hint, children }) {
  return (
    <div className="field">
      <label>{label}{children}</label>
      {hint && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  );
}

// One form for Create, New Version, Template, and Edit. Note: no user_id field - the server takes it from the JWT.
export default function CapsuleForm({ capsule, initialValues, onSubmit, onCancel }) {
  const editing = Boolean(capsule);
  const seed = capsule ?? initialValues;
  const [form, setForm] = useState({
    project_name: seed?.project_name ?? "",
    prompt_title: seed?.prompt_title ?? "",
    prompt_version: seed?.prompt_version ?? "",
    prompt_text: seed?.prompt_text ?? "",
    response_summary: seed?.response_summary ?? "",
    category: seed?.category ?? "Coding",
    usefulness: seed?.usefulness ?? "",
    reviewed: Boolean(seed?.reviewed),
    improved: Boolean(seed?.improved),
    screenshot_url: seed?.screenshot_url ?? "",
    notes: seed?.notes ?? "",
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const categories = form.category && !CATEGORIES.includes(form.category) ? [form.category, ...CATEGORIES] : CATEGORIES;

  const detectedVars = extractVariables(form.prompt_text);
  const tokenEst = estimateTokens(form.prompt_text);

  function applyTemplate(tpl) {
    setForm((f) => ({
      ...f,
      project_name: tpl.project_name,
      prompt_title: tpl.prompt_title,
      prompt_version: tpl.prompt_version,
      prompt_text: tpl.prompt_text,
      category: tpl.category,
      notes: tpl.notes,
    }));
    setErrors({});
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError(null);
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setServerError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <form className="modal" role="dialog" aria-modal="true" aria-label={editing ? "Edit capsule" : "New capsule"} onSubmit={handleSubmit} noValidate>
        <h2>{editing ? "Edit capsule" : initialValues?.prompt_version ? "New prompt version" : "New capsule"}</h2>
        {serverError && <div className="banner error" role="alert">{serverError}</div>}

        {!editing && !initialValues && (
          <div className="template-strip" aria-label="Quick templates">
            <span className="template-strip-label">Templates:</span>
            {STARTER_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="template-chip"
                onClick={() => applyTemplate(tpl)}
              >
                {tpl.icon} {tpl.label}
              </button>
            ))}
          </div>
        )}

        <div className="row">
          <Field label="Project name *" error={errors.project_name}>
            <input value={form.project_name} onChange={set("project_name")} placeholder="SmartFarm Irrigation" />
          </Field>
          <Field label="Prompt version">
            <input value={form.prompt_version} onChange={set("prompt_version")} placeholder="v1" />
          </Field>
        </div>

        <Field label="Prompt title *" error={errors.prompt_title}>
          <input value={form.prompt_title} onChange={set("prompt_title")} placeholder="Debug cloud deployment" />
        </Field>

        <Field
          label="Prompt text *"
          error={errors.prompt_text}
          hint={
            <>
              ~{tokenEst} tokens · {form.prompt_text.length} chars
              {detectedVars.length > 0 && ` · Variables: ${detectedVars.map((v) => `{{${v}}}`).join(", ")}`}
              {detectedVars.length === 0 && " · Tip: use {{variable}} for reusable inputs"}
            </>
          }
        >
          <textarea rows={4} value={form.prompt_text} onChange={set("prompt_text")} placeholder="Why does my Node server fail?" />
        </Field>

        <Field label="Response summary">
          <textarea rows={3} value={form.response_summary} onChange={set("response_summary")} placeholder="Check start command" />
        </Field>

        <div className="row">
          <Field label="Category">
            <select value={form.category} onChange={set("category")}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Usefulness">
            <select value={form.usefulness} onChange={set("usefulness")}>
              <option value="">Not rated</option>
              {USEFULNESS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
        </div>

        <div className="checks">
          <label><input type="checkbox" checked={form.reviewed} onChange={set("reviewed")} /> Response reviewed</label>
          <label><input type="checkbox" checked={form.improved} onChange={set("improved")} /> Output improved</label>
        </div>

        <Field label="Screenshot evidence (URL)" error={errors.screenshot_url}>
          <input value={form.screenshot_url} onChange={set("screenshot_url")} placeholder="https://..." />
        </Field>

        <Field label="Notes">
          <textarea rows={2} value={form.notes} onChange={set("notes")} placeholder="Tested and worked" />
        </Field>

        <div className="button-row">
          <button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Create capsule"}</button>
          <button type="button" className="secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
