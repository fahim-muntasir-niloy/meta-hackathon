/**
 * Form submissions from generated UI are sent as one user message: the button
 * label, then the field values in a block the model can read. The chat shows
 * the label and the values as chips instead of the raw text.
 */
const MARKER = "\n\nForm answers:\n";

export type FormAnswers = Record<string, string>;

/** Flattens OpenUI form state ({ form: { field: { value } } }) into field → value. */
export function flattenFormState(state: Record<string, unknown> | undefined): FormAnswers {
  const answers: FormAnswers = {};
  for (const fields of Object.values(state ?? {})) {
    if (!fields || typeof fields !== "object") continue;
    for (const [field, raw] of Object.entries(fields as Record<string, unknown>)) {
      const value = raw && typeof raw === "object" && "value" in raw ? (raw as { value: unknown }).value : raw;
      if (value === undefined || value === null || value === "") continue;
      answers[field] = Array.isArray(value) ? value.map(formatValue).join(", ") : formatValue(value);
    }
  }
  return answers;
}

/** Dates go to the model as local YYYY-MM-DD, not "Fri Oct 30 2026 00:00:00 GMT+0600". */
function formatValue(value: unknown): string {
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  return String(value);
}

export function encodeFormMessage(label: string, answers: FormAnswers): string {
  const lines = Object.entries(answers).map(([k, v]) => `- ${k}: ${v}`);
  return lines.length ? `${label}${MARKER}${lines.join("\n")}` : label;
}

export function decodeFormMessage(text: string): { label: string; answers: FormAnswers } {
  const at = text.indexOf(MARKER);
  if (at < 0) return { label: text, answers: {} };
  const answers: FormAnswers = {};
  for (const line of text.slice(at + MARKER.length).split("\n")) {
    const m = line.match(/^- ([^:]+): (.*)$/);
    if (m) answers[m[1]] = m[2];
  }
  return { label: text.slice(0, at), answers };
}
