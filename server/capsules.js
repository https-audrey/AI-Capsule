// capsules.js - CRUD for the authenticated user's prompt records.
// router.use(requireAuth) protects GET, POST, PUT and DELETE. user_id is ALWAYS taken from
// the verified JWT (req.user.id); any user_id in the request body is ignored, and every
// query is scoped with `AND user_id = ?` so users can only touch their own rows.
const express = require("express");
const db = require("./db");
const { requireAuth } = require("./auth");

const router = express.Router();
router.use(requireAuth);

const TEXT_LIMITS = {
  project_name: 200, prompt_title: 200, prompt_version: 50, prompt_text: 20000,
  response_summary: 20000, category: 100, usefulness: 100, screenshot_url: 2000, notes: 5000,
};
const REQUIRED = ["project_name", "prompt_title", "prompt_text"];
const COLUMNS = "id, user_id, project_name, prompt_title, prompt_version, prompt_text, response_summary, category, usefulness, reviewed, improved, screenshot_url, notes, created_at";

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function toFlag(v) {
  if (v === true || v === 1 || v === "1" || v === "Yes" || v === "yes" || v === "true") return 1;
  if (v === false || v === 0 || v === "0" || v === "No" || v === "no" || v === "false" || v === null || v === "") return 0;
  return undefined;
}

// Merge the request body over `base`, validate, and return { values } or { error }.
function build(body, base) {
  const out = { ...base };
  for (const field of Object.keys(TEXT_LIMITS)) {
    if (body[field] === undefined) continue;
    const v = body[field] === null ? "" : body[field];
    if (typeof v !== "string") return { error: `${field} must be a string` };
    out[field] = v.trim();
  }
  for (const field of REQUIRED) if (!out[field]) return { error: `${field} is required` };
  for (const [field, max] of Object.entries(TEXT_LIMITS)) {
    if (out[field].length > max) return { error: `${field} must be ${max} characters or fewer` };
  }
  if (out.screenshot_url) {
    let url;
    try { url = new URL(out.screenshot_url); } catch { return { error: "screenshot_url must be a valid http(s) URL" }; }
    if (!["http:", "https:"].includes(url.protocol)) return { error: "screenshot_url must be a valid http(s) URL" };
  }
  for (const field of ["reviewed", "improved"]) {
    if (body[field] === undefined) continue;
    const flag = toFlag(body[field]);
    if (flag === undefined) return { error: `${field} must be Yes/No (true/false)` };
    out[field] = flag;
  }
  return { values: out };
}

const emptyRecord = () => ({ ...Object.fromEntries(Object.keys(TEXT_LIMITS).map((f) => [f, ""])), reviewed: 0, improved: 0 });
const fromRow = (row) => ({
  ...Object.fromEntries(Object.keys(TEXT_LIMITS).map((f) => [f, row[f] ?? ""])),
  reviewed: row.reviewed ? 1 : 0,
  improved: row.improved ? 1 : 0,
});

const findOwned = (id, userId) => {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) return undefined;
  return db.prepare(`SELECT ${COLUMNS} FROM capsules WHERE id = ? AND user_id = ?`).get(n, userId);
};

router.get("/", (req, res) => {
  const rows = db
    .prepare(`SELECT ${COLUMNS} FROM capsules WHERE user_id = ? ORDER BY created_at DESC, id DESC`)
    .all(req.user.id);
  res.json(rows);
});

router.post("/", (req, res) => {
  if (!isObject(req.body)) return res.status(400).json({ error: "Request body must be a JSON object" });
  const { values, error } = build(req.body, emptyRecord());
  if (error) return res.status(400).json({ error });

  const info = db
    .prepare(
      `INSERT INTO capsules (user_id, project_name, prompt_title, prompt_version, prompt_text, response_summary,
                             category, usefulness, reviewed, improved, screenshot_url, notes)
       VALUES (@user_id, @project_name, @prompt_title, @prompt_version, @prompt_text, @response_summary,
               @category, @usefulness, @reviewed, @improved, @screenshot_url, @notes)`
    )
    .run({ ...values, user_id: req.user.id }); // owner comes from the verified JWT only
  res.status(201).json(findOwned(info.lastInsertRowid, req.user.id));
});

router.put("/:id", (req, res) => {
  const existing = findOwned(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Capsule not found" }); // also hides other users' ids
  if (!isObject(req.body)) return res.status(400).json({ error: "Request body must be a JSON object" });

  const { values, error } = build(req.body, fromRow(existing)); // omitted fields keep their value
  if (error) return res.status(400).json({ error });

  db.prepare(
    `UPDATE capsules SET project_name=@project_name, prompt_title=@prompt_title, prompt_version=@prompt_version,
            prompt_text=@prompt_text, response_summary=@response_summary, category=@category, usefulness=@usefulness,
            reviewed=@reviewed, improved=@improved, screenshot_url=@screenshot_url, notes=@notes
     WHERE id=@id AND user_id=@user_id`
  ).run({ ...values, id: existing.id, user_id: req.user.id });
  res.json(findOwned(existing.id, req.user.id));
});

router.delete("/:id", (req, res) => {
  const existing = findOwned(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Capsule not found" });
  db.prepare("DELETE FROM capsules WHERE id = ? AND user_id = ?").run(existing.id, req.user.id);
  res.json({ deleted: true, id: existing.id });
});

module.exports = router;
