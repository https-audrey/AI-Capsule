// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../ThemeContext";
import App from "../App";

let rows, nextId, signedIn, calls;
const reply = (status, body) => Promise.resolve({ ok: status < 400, status, json: async () => body });

beforeEach(() => {
  rows = []; nextId = 1; signedIn = true; calls = [];
  vi.stubGlobal("confirm", () => true);
  vi.stubGlobal("fetch", async (url, opts = {}) => {
    const method = opts.method ?? "GET";
    calls.push({ method, url, body: opts.body ? JSON.parse(opts.body) : undefined });
    if (url === "/api/auth/me") return signedIn ? reply(200, { id: "1001", login: "alice" }) : reply(401, { error: "Unauthorized" });
    if (url === "/api/auth/logout") { signedIn = false; return reply(200, { ok: true }); }
    if (!signedIn) return reply(401, { error: "Unauthorized" });
    if (url === "/api/capsules" && method === "GET") return reply(200, rows.map((r) => ({ ...r })));
    if (url === "/api/capsules" && method === "POST") {
      const b = JSON.parse(opts.body);
      const row = { id: nextId++, user_id: "1001", created_at: "2026-11-25 10:00:00", prompt_version: "", response_summary: "", category: "", usefulness: "", screenshot_url: "", notes: "", ...b, reviewed: b.reviewed ? 1 : 0, improved: b.improved ? 1 : 0 };
      rows.unshift(row); return reply(201, row);
    }
    const id = Number(url.split("/").pop());
    if (method === "PUT") { const i = rows.findIndex((r) => r.id === id); rows[i] = { ...rows[i], ...JSON.parse(opts.body) }; return reply(200, rows[i]); }
    if (method === "DELETE") { rows = rows.filter((r) => r.id !== id); return reply(200, { deleted: true, id }); }
    return reply(404, { error: "Not found" });
  });
});

const renderAt = (path) => render(<MemoryRouter initialEntries={[path]}><ThemeProvider><App /></ThemeProvider></MemoryRouter>);
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
async function createCapsule(title = "Debug cloud deployment") {
  fireEvent.click(screen.getAllByText("+ New capsule")[0]);
  await screen.findByRole("dialog");
  type(/Project name/, "SmartFarm Irrigation"); type(/Prompt title/, title); type(/Prompt text/, "Why does my Node server fail?"); type("Prompt version", "v1");
  fireEvent.click(screen.getByText("Create capsule"));
  await screen.findByText(title);
}

describe("AI Capsule UI", () => {
  it("public landing page explains the app and invites a visitor to sign in", async () => {
    signedIn = false;
    renderAt("/");
    expect(await screen.findByText(/Keep every useful AI prompt/)).toBeTruthy();
    expect((await screen.findByText(/Sign in to get started/)).getAttribute("href")).toBe("/login");
  });

  it("landing page offers the dashboard to a visitor who is already signed in", async () => {
    renderAt("/");
    expect((await screen.findByText(/Open dashboard \(alice\)/)).getAttribute("href")).toBe("/dashboard");
  });

  it("login page links to the server-side OAuth start and shows a failure message", async () => {
    renderAt("/login?error=oauth_failed");
    expect(screen.getByText("Sign in with GitHub").closest("a").getAttribute("href")).toBe("/api/auth/github");
    expect(screen.getByRole("alert").textContent).toContain("did not complete");
  });

  it("dashboard redirects to /login when the API says 401 (not signed in)", async () => {
    signedIn = false;
    renderAt("/dashboard");
    expect(await screen.findByText("Sign in with GitHub")).toBeTruthy();
    expect(calls.some((c) => c.url === "/api/capsules")).toBe(false); // no capsule data requested
  });

  it("signed-in dashboard shows the username and the empty state", async () => {
    renderAt("/dashboard");
    expect((await screen.findByTestId("username")).textContent).toBe("alice");
    expect(screen.getByTestId("empty-state")).toBeTruthy();
  });

  it("CREATE sends the record without any user_id and shows it", async () => {
    renderAt("/dashboard"); await screen.findByTestId("empty-state");
    await createCapsule();
    const post = calls.find((c) => c.method === "POST");
    expect(post.body.project_name).toBe("SmartFarm Irrigation");
    expect("user_id" in post.body).toBe(false);
    expect(screen.queryByTestId("empty-state")).toBeNull();
    expect(screen.getByText("v1")).toBeTruthy();
  });

  it("form validation blocks an empty submit before any request", async () => {
    renderAt("/dashboard"); await screen.findByTestId("empty-state");
    fireEvent.click(screen.getAllByText("+ New capsule")[0]);
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByText("Create capsule"));
    expect((await screen.findAllByRole("alert")).length).toBe(3);
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    type(/Project name/, "P"); type(/Prompt title/, "T"); type(/Prompt text/, "X"); type(/Screenshot/, "javascript:alert(1)");
    fireEvent.click(screen.getByText("Create capsule"));
    expect(await screen.findByText("Enter a valid http(s) link.")).toBeTruthy();
  });

  it("UPDATE changes an existing record", async () => {
    renderAt("/dashboard"); await screen.findByTestId("empty-state");
    await createCapsule();
    fireEvent.click(screen.getByText("Edit"));
    await screen.findByRole("dialog");
    expect(screen.getByLabelText("Prompt version").value).toBe("v1");
    type("Prompt version", "v2");
    fireEvent.click(screen.getByText("Save changes"));
    await waitFor(() => expect(screen.getByText("v2")).toBeTruthy());
    expect(calls.find((c) => c.method === "PUT").url).toBe("/api/capsules/1");
  });

  it("DELETE removes the record and returns to the empty state", async () => {
    renderAt("/dashboard"); await screen.findByTestId("empty-state");
    await createCapsule();
    fireEvent.click(screen.getByText("Delete"));
    const dialog = await screen.findByRole("dialog", { name: "Delete capsule confirmation" });
    fireEvent.click(within(dialog).getByText("Delete capsule"));
    await screen.findByTestId("empty-state");
    expect(calls.find((c) => c.method === "DELETE").url).toBe("/api/capsules/1");
  });

  it("a server validation error is shown inside the form", async () => {
    renderAt("/dashboard"); await screen.findByTestId("empty-state");
    const original = globalThis.fetch;
    vi.stubGlobal("fetch", async (url, opts = {}) => (opts.method === "POST" ? reply(400, { error: "notes must be 5000 characters or fewer" }) : original(url, opts)));
    fireEvent.click(screen.getAllByText("+ New capsule")[0]);
    await screen.findByRole("dialog");
    type(/Project name/, "P"); type(/Prompt title/, "T"); type(/Prompt text/, "X");
    fireEvent.click(screen.getByText("Create capsule"));
    expect(await screen.findByText("notes must be 5000 characters or fewer")).toBeTruthy();
  });

  it("sign out calls logout and returns to /login", async () => {
    renderAt("/dashboard");
    fireEvent.click(await screen.findByText("Sign out"));
    expect(await screen.findByText("Sign in with GitHub")).toBeTruthy();
    expect(calls.some((c) => c.url === "/api/auth/logout")).toBe(true);
  });

  it("starter template prefills a new capsule and Use modal fills {{variables}}", async () => {
    renderAt("/dashboard"); await screen.findByTestId("empty-state");
    fireEvent.click(screen.getByText("Code Security Review"));
    await screen.findByRole("dialog");
    expect(screen.getByLabelText(/Prompt title/).value).toBe("Security & Edge-Case Code Review");
    fireEvent.click(screen.getByText("Create capsule"));
    await screen.findByText("Security & Edge-Case Code Review");

    // Open variable filler modal
    fireEvent.click(screen.getByText(/Fill 2 vars/));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText("Enter language..."), { target: { value: "TypeScript" } });
    fireEvent.change(within(dialog).getByPlaceholderText("Enter code..."), { target: { value: "const x = 1;" } });
    expect(within(dialog).getByText(/Review the following TypeScript code/)).toBeTruthy();
    fireEvent.click(within(dialog).getByText("Close"));
  });

  it("New version bumps version and quick-toggle updates Reviewed status", async () => {
    renderAt("/dashboard"); await screen.findByTestId("empty-state");
    await createCapsule();

    // Quick toggle Reviewed on card
    fireEvent.click(screen.getByText("Reviewed: No"));
    await waitFor(() => expect(screen.getByText("Reviewed: Yes")).toBeTruthy());
    expect(calls.find((c) => c.method === "PUT").body.reviewed).toBe(true);

    // New version flow
    fireEvent.click(screen.getByText("New version"));
    await screen.findByRole("dialog");
    expect(screen.getByLabelText("Prompt version").value).toBe("v2");
    fireEvent.click(screen.getByText("Create capsule"));
    await waitFor(() => expect(screen.getByText("v2")).toBeTruthy());
  });
});
