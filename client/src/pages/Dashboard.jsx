import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../api";
import CapsuleCard from "../components/CapsuleCard";
import CapsuleForm from "../components/CapsuleForm";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import ThemeToggle from "../components/ThemeToggle";
import UsePromptModal from "../components/UsePromptModal";
import { STARTER_TEMPLATES, nextVersion } from "../templates";

const FILTER_CATEGORIES = ["All", "Coding", "Writing", "Research", "Study", "Other"];

export default function Dashboard() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [user, setUser] = useState(null);
  const [capsules, setCapsules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null); // null | { capsule?, initialValues? }
  const [usingCapsule, setUsingCapsule] = useState(null);
  const [deletingCapsule, setDeletingCapsule] = useState(null);
  const [notice, setNotice] = useState(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [projectFilter, setProjectFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newest");

  // Any 401 means the session is missing or expired: go back to /login.
  const handleError = useCallback((err) => {
    if (err.status === 401) navigate("/login", { replace: true });
    else setError(err.message);
  }, [navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUser(await api.getMe());
      setCapsules(await api.listCapsules()); // READ: only this user's records
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const stats = useMemo(() => ({
    total: capsules.length,
    reviewed: capsules.filter((c) => c.reviewed).length,
    improved: capsules.filter((c) => c.improved).length,
    good: capsules.filter((c) => c.usefulness === "Good").length,
  }), [capsules]);

  const projects = useMemo(
    () => Array.from(new Set(capsules.map((c) => c.project_name).filter(Boolean))).sort(),
    [capsules]
  );

  const filteredCapsules = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = capsules.filter((c) => {
      if (categoryFilter !== "All" && c.category !== categoryFilter) return false;
      if (projectFilter !== "All" && c.project_name !== projectFilter) return false;
      if (!q) return true;
      return [c.prompt_title, c.project_name, c.prompt_text, c.notes, c.response_summary]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });

    if (sortBy === "oldest") return [...list].reverse();
    if (sortBy === "title") return [...list].sort((a, b) => a.prompt_title.localeCompare(b.prompt_title));
    if (sortBy === "project") return [...list].sort((a, b) => a.project_name.localeCompare(b.project_name));
    return list;
  }, [capsules, query, categoryFilter, projectFilter, sortBy]);

  async function save(values) {
    try {
      if (form.capsule) {
        const updated = await api.updateCapsule(form.capsule.id, values); // UPDATE
        setCapsules((list) => list.map((c) => (c.id === updated.id ? updated : c)));
        setNotice("Capsule updated.");
      } else {
        const created = await api.createCapsule(values); // CREATE
        setCapsules((list) => [created, ...list]);
        setNotice("Capsule created.");
      }
      setForm(null);
    } catch (err) {
      if (err.status === 401) navigate("/login", { replace: true });
      else throw err; // shown inside the form
    }
  }

  async function toggleFlag(capsule, field) {
    const nextVal = !capsule[field];
    try {
      const updated = await api.updateCapsule(capsule.id, { [field]: nextVal });
      setCapsules((list) => list.map((c) => (c.id === updated.id ? updated : c)));
      setNotice(`Marked ${field} as ${nextVal ? "Yes" : "No"}.`);
    } catch (err) {
      handleError(err);
    }
  }

  function startNewVersion(capsule) {
    setForm({
      initialValues: {
        project_name: capsule.project_name,
        prompt_title: capsule.prompt_title,
        prompt_version: nextVersion(capsule.prompt_version),
        prompt_text: capsule.prompt_text,
        response_summary: "",
        category: capsule.category || "Coding",
        usefulness: "",
        reviewed: false,
        improved: true,
        screenshot_url: "",
        notes: capsule.notes || "",
      },
    });
  }

  function startFromTemplate(tpl) {
    setForm({
      initialValues: {
        project_name: tpl.project_name,
        prompt_title: tpl.prompt_title,
        prompt_version: tpl.prompt_version,
        prompt_text: tpl.prompt_text,
        category: tpl.category,
        notes: tpl.notes,
      },
    });
  }

  function exportJson() {
    const payload = capsules.map(({
      project_name, prompt_title, prompt_version, prompt_text, response_summary,
      category, usefulness, reviewed, improved, screenshot_url, notes,
    }) => ({
      project_name, prompt_title, prompt_version, prompt_text, response_summary,
      category, usefulness, reviewed: Boolean(reviewed), improved: Boolean(improved), screenshot_url, notes,
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ai-capsule-library.json";
    a.click();
    URL.revokeObjectURL(url);
    setNotice(`Exported ${payload.length} capsule${payload.length === 1 ? "" : "s"}.`);
  }

  async function importJson(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      let imported = 0;
      for (const item of items) {
        if (!item?.project_name || !item?.prompt_title || !item?.prompt_text) continue;
        const created = await api.createCapsule({
          project_name: String(item.project_name),
          prompt_title: String(item.prompt_title),
          prompt_version: item.prompt_version ? String(item.prompt_version) : "",
          prompt_text: String(item.prompt_text),
          response_summary: item.response_summary ? String(item.response_summary) : "",
          category: item.category ? String(item.category) : "Coding",
          usefulness: item.usefulness ? String(item.usefulness) : "",
          reviewed: Boolean(item.reviewed),
          improved: Boolean(item.improved),
          screenshot_url: item.screenshot_url ? String(item.screenshot_url) : "",
          notes: item.notes ? String(item.notes) : "",
        });
        setCapsules((list) => [created, ...list]);
        imported += 1;
      }
      setNotice(imported ? `Imported ${imported} capsule${imported === 1 ? "" : "s"}.` : "No valid capsules found in file.");
    } catch (err) {
      if (err.status === 401) navigate("/login", { replace: true });
      else setError("Could not import JSON file. Check that it contains valid capsule records.");
    }
  }

  async function confirmRemove(capsule) {
    try {
      await api.deleteCapsule(capsule.id); // DELETE
      setCapsules((list) => list.filter((c) => c.id !== capsule.id));
      setDeletingCapsule(null);
      setNotice("Capsule deleted.");
    } catch (err) {
      setDeletingCapsule(null);
      handleError(err);
    }
  }

  async function signOut() {
    try { await api.logout(); } finally { navigate("/login", { replace: true }); }
  }

  if (loading) return <main className="page"><p role="status" className="loading">Loading your capsules…</p></main>;

  return (
    <main className="page">
      <header className="glass-card topbar">
        <div className="topbar-brand">
          <span className="logo"><span className="logo-icon">◈</span> AI Capsule</span>
          <h1>Your prompt library</h1>
          {user && (
            <p className="muted user-badge-row">
              <span className="user-avatar" aria-hidden="true">{user.login?.[0]?.toUpperCase() || "U"}</span>
              Signed in as <strong data-testid="username">{user.login}</strong>
            </p>
          )}
        </div>
        <div className="topbar-actions">
          <ThemeToggle />
          <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={importJson} />
          <button type="button" className="secondary btn-sm" onClick={() => fileInputRef.current?.click()}>Import</button>
          {capsules.length > 0 && (
            <button type="button" className="secondary btn-sm" onClick={exportJson}>Export</button>
          )}
          <button onClick={() => setForm({})}>+ New capsule</button>
          <button className="secondary" onClick={signOut}>Sign out</button>
        </div>
      </header>

      {error && (
        <div className="banner error" role="alert">
          {error} <button className="link" onClick={load}>Retry</button>
        </div>
      )}
      {notice && <div className="banner success" role="status">{notice}</div>}

      {!error && capsules.length > 0 && (
        <>
          <section className="stats-strip" aria-label="Library summary">
            <div className="glass-card stat-pill">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">Total Capsules</span>
            </div>
            <div className="glass-card stat-pill">
              <span className="stat-value">{stats.good}</span>
              <span className="stat-label">Rated Good</span>
            </div>
            <div className="glass-card stat-pill">
              <span className="stat-value">{stats.reviewed}</span>
              <span className="stat-label">Reviewed</span>
            </div>
            <div className="glass-card stat-pill">
              <span className="stat-value">{stats.improved}</span>
              <span className="stat-label">Improved</span>
            </div>
          </section>

          <section className="toolbar" aria-label="Filter capsules">
            <input
              type="search"
              className="search-input"
              placeholder="Search prompts, projects, or notes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search capsules"
            />
            {projects.length > 1 && (
              <select
                className="toolbar-select"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                aria-label="Filter by project"
              >
                <option value="All">All projects</option>
                {projects.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            <select
              className="toolbar-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort capsules"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title (A–Z)</option>
              <option value="project">Project (A–Z)</option>
            </select>
            <div className="filter-pills" role="group" aria-label="Category filter">
              {FILTER_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`filter-pill ${categoryFilter === cat ? "active" : ""}`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {!error && capsules.length === 0 ? (
        <div className="glass-card empty" data-testid="empty-state">
          <div className="empty-emblem" aria-hidden="true">✦</div>
          <h2>No capsules yet</h2>
          <p>Save your first prompt or start from a reusable template below.</p>
          <button onClick={() => setForm({})}>+ New capsule</button>

          <div className="starter-grid" aria-label="Starter prompt templates">
            {STARTER_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="starter-card"
                onClick={() => startFromTemplate(tpl)}
              >
                <span className="starter-icon">{tpl.icon}</span>
                <span className="starter-title">{tpl.label}</span>
                <span className="starter-meta">{tpl.category} · Uses variables</span>
              </button>
            ))}
          </div>
        </div>
      ) : filteredCapsules.length === 0 && !error ? (
        <div className="glass-card empty">
          <h2>No matching capsules</h2>
          <p>Try clearing your search or switching filters.</p>
          <button
            type="button"
            className="secondary"
            onClick={() => { setQuery(""); setCategoryFilter("All"); setProjectFilter("All"); }}
          >
            Reset filters
          </button>
        </div>
      ) : (
        <section className="grid">
          {filteredCapsules.map((c) => (
            <CapsuleCard
              key={c.id}
              capsule={c}
              onEdit={(capsule) => setForm({ capsule })}
              onDelete={(capsule) => setDeletingCapsule(capsule)}
              onUse={setUsingCapsule}
              onNewVersion={startNewVersion}
              onToggleFlag={toggleFlag}
            />
          ))}
        </section>
      )}

      {form && (
        <CapsuleForm
          key={form.capsule?.id ?? form.initialValues?.prompt_title ?? "new"}
          capsule={form.capsule}
          initialValues={form.initialValues}
          onSubmit={save}
          onCancel={() => setForm(null)}
        />
      )}

      {usingCapsule && (
        <UsePromptModal capsule={usingCapsule} onClose={() => setUsingCapsule(null)} />
      )}

      {deletingCapsule && (
        <ConfirmDeleteModal
          capsule={deletingCapsule}
          onConfirm={confirmRemove}
          onCancel={() => setDeletingCapsule(null)}
        />
      )}
    </main>
  );
}
