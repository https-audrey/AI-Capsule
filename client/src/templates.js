// Starter prompt templates and lightweight prompt engineering helpers

export const STARTER_TEMPLATES = [
  {
    id: "code-review",
    icon: "🛡️",
    label: "Code Security Review",
    project_name: "Backend API",
    prompt_title: "Security & Edge-Case Code Review",
    prompt_version: "v1",
    category: "Coding",
    prompt_text:
      "Review the following {{language}} code for security vulnerabilities, unhandled edge cases, and input validation gaps.\n\nFocus on:\n1. Auth/ownership checks\n2. Error handling\n3. Clear, minimal fixes\n\nCode:\n{{code}}",
    notes: "Use {{language}} and {{code}} placeholders before pasting into your AI chat.",
  },
  {
    id: "bug-diagnosis",
    icon: "🐛",
    label: "Root-Cause Debugger",
    project_name: "Troubleshooting",
    prompt_title: "Diagnose Error & Minimal Fix",
    prompt_version: "v1",
    category: "Coding",
    prompt_text:
      "I am seeing this error in {{environment}}:\n{{error_message}}\n\nExplain the most likely root cause first, then suggest the smallest safe fix and how to verify it.",
    notes: "Great for fast stack-trace triage without rewriting unrelated files.",
  },
  {
    id: "study-feynman",
    icon: "🎓",
    label: "Concept Explainer",
    project_name: "University Study",
    prompt_title: "Explain {{topic}} Simply",
    prompt_version: "v1",
    category: "Study",
    prompt_text:
      "Explain {{topic}} at a {{level}} level using a concrete real-world analogy, one short worked example, and 3 quick self-test questions (with answers hidden at the bottom).",
    notes: "Active-recall prompt for exam prep.",
  },
  {
    id: "concise-writing",
    icon: "✍️",
    label: "Clarity Editor",
    project_name: "Documentation",
    prompt_title: "Tighten Draft & Improve Tone",
    prompt_version: "v1",
    category: "Writing",
    prompt_text:
      "Rewrite the draft below for {{audience}} in a {{tone}} tone. Cut filler words by ~30% while keeping every factual claim intact.\n\nDraft:\n{{draft}}",
    notes: "Useful for READMEs, emails, and project reports.",
  },
];

// Extract unique {{variable}} names in order of appearance
export function extractVariables(text = "") {
  const seen = new Set();
  const vars = [];
  const regex = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      vars.push(match[1]);
    }
  }
  return vars;
}

// Fill {{variable}} placeholders with user-supplied values
export function fillVariables(text = "", values = {}) {
  return text.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (full, key) =>
    values[key] && values[key].trim() ? values[key] : full
  );
}

// Bump version string: v1 -> v2, v2.1 -> v2.2, empty -> v2
export function nextVersion(version = "") {
  const trimmed = version.trim();
  if (!trimmed) return "v2";
  const match = trimmed.match(/^(.*?)(\d+)$/);
  if (!match) return `${trimmed}-v2`;
  return `${match[1]}${Number(match[2]) + 1}`;
}

// Rough token count estimate (~4 chars per token for English/code)
export function estimateTokens(text = "") {
  const len = text.trim().length;
  return len ? Math.max(1, Math.round(len / 4)) : 0;
}
