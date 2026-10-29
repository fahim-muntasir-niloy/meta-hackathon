// Progressive-rendering helpers for streamed openui-lang, adapted from the
// LangChain OpenUI integration guide. Re-parsing on every token makes charts
// crash on unresolved data and wastes work, so the Renderer only gets a new
// snapshot when a complete statement has arrived.

import { useState } from "react";

/** Strip any markdown code fence the model may have emitted. */
export function stripCodeFence(text: string): string {
  return text
    .replace(/^\s*```[a-z-]*\r?\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

/** Whether the text looks like an openui-lang program rather than prose. */
export function looksLikeOpenUI(text: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9_]*\s*=\s*[A-Z@\["]/m.test(text);
}

/** The parser only accepts camelCase identifiers; rename snake_case ones outside strings. */
export function sanitizeIdentifiers(text: string): string {
  const toCamel = (s: string) => s.replace(/_([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase());

  const snakeVars: string[] = [];
  for (const m of text.matchAll(/^([a-zA-Z][a-zA-Z0-9]*(?:_[a-zA-Z0-9]+)+)\s*=/gm)) {
    if (!snakeVars.includes(m[1])) snakeVars.push(m[1]);
  }
  if (snakeVars.length === 0) return text;

  let result = "";
  let inStr = false;
  let i = 0;
  while (i < text.length) {
    if (text[i] === "\\" && inStr) {
      result += text[i] + (text[i + 1] ?? "");
      i += 2;
      continue;
    }
    if (text[i] === '"') {
      inStr = !inStr;
      result += text[i++];
      continue;
    }
    if (!inStr) {
      const v = snakeVars.find(
        (name) => text.startsWith(name, i) && !/[a-zA-Z0-9_]/.test(text[i - 1] ?? "") && !/[a-zA-Z0-9_]/.test(text[i + name.length] ?? ""),
      );
      if (v) {
        result += toCamel(v);
        i += v.length;
        continue;
      }
    }
    result += text[i++];
  }
  return result;
}

/** Index of the last newline outside a string, and whether the text ends inside one. */
function scanStrings(text: string): { inStr: boolean; lastSafeNewline: number } {
  let inStr = false;
  let lastSafeNewline = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\" && inStr) {
      i++;
      continue;
    }
    if (ch === '"') inStr = !inStr;
    else if (ch === "\n" && !inStr) lastSafeNewline = i;
  }
  return { inStr, lastSafeNewline };
}

/** Drop a trailing partial string literal, back to the last safe newline. */
export function truncateAtOpenString(text: string): string {
  const { inStr, lastSafeNewline } = scanStrings(text);
  return inStr ? text.slice(0, lastSafeNewline) : text;
}

/** Like truncateAtOpenString, but closes a partial TextContent so prose streams in token by token. */
export function closeOrTruncateOpenString(text: string): string {
  const { inStr, lastSafeNewline } = scanStrings(text);
  if (!inStr) return text;

  const safeText = lastSafeNewline > 0 ? text.slice(0, lastSafeNewline) : "";
  const partialLine = text.slice(lastSafeNewline > 0 ? lastSafeNewline + 1 : 0);
  if (/^[a-zA-Z][a-zA-Z0-9]*\s*=\s*(TextContent|MarkDownRenderer)\(/.test(partialLine)) {
    return (safeText ? safeText + "\n" : "") + partialLine + '")';
  }
  return safeText;
}

function countCompleteStatements(text: string): number {
  let count = 0;
  for (const line of text.split("\n")) {
    const t = line.trimEnd();
    if ((t.endsWith(")") || t.endsWith("]")) && /^[a-zA-Z]/.test(t)) count++;
  }
  return count;
}

const CHART_TYPES = new Set([
  "BarChart", "LineChart", "AreaChart", "RadarChart", "HorizontalBarChart",
  "PieChart", "RadialChart", "SingleStackedBarChart", "ScatterChart",
]);

const KEYWORDS = new Set([
  "true", "false", "null", "grouped", "stacked", "linear", "natural", "step", "pie", "donut",
  "string", "number", "action", "row", "column", "card", "sunk", "clear", "info", "warning",
  "error", "success", "neutral", "danger", "start", "end", "center", "between", "around",
  "evenly", "stretch", "baseline", "small", "default", "large", "none", "xs", "s", "m", "l",
  "xl", "horizontal", "vertical",
]);

/** Charts crash on unresolved labels/series, so hold a snapshot until their data is defined. */
function chartDataRefsResolved(text: string): boolean {
  const lines = text.split("\n");
  const complete = new Set<string>();
  for (const line of lines) {
    const t = line.trimEnd();
    const m = t.match(/^([a-zA-Z][a-zA-Z0-9]*)\s*=/);
    if (m && (t.endsWith(")") || t.endsWith("]"))) complete.add(m[1]);
  }
  for (const line of lines) {
    const t = line.trimEnd();
    const m = t.match(/^([a-zA-Z][a-zA-Z0-9]*)\s*=\s*([A-Z][a-zA-Z0-9]*)\(/);
    if (!m || !CHART_TYPES.has(m[2]) || !t.endsWith(")")) continue;
    const rhs = t.slice(t.indexOf("=") + 1).replace(/"(?:[^"\\]|\\.)*"/g, '""');
    for (const [, name] of rhs.matchAll(/\b([a-zA-Z][a-zA-Z0-9]*)\b/g)) {
      if (/^[a-z]/.test(name) && !KEYWORDS.has(name) && !complete.has(name)) return false;
    }
  }
  return true;
}

/** If the model has not written `root` yet, synthesise one from the top-level variables. */
export function buildProgressiveRoot(text: string): string {
  if (!text) return text;
  const safe = truncateAtOpenString(text);
  if (/^root\s*=/m.test(safe)) return safe;

  const defs: string[] = [];
  for (const m of safe.matchAll(/^([a-zA-Z][a-zA-Z0-9]*)\s*=/gm)) {
    if (!defs.includes(m[1])) defs.push(m[1]);
  }
  if (defs.length === 0) return safe;

  const referenced = new Set<string>();
  for (const line of safe.split("\n")) {
    const thisVar = line.match(/^([a-zA-Z][a-zA-Z0-9]*)\s*=/)?.[1];
    const stripped = line.replace(/"(?:[^"\\]|\\.)*"/g, '""');
    for (const v of defs) {
      if (v !== thisVar && new RegExp(`\\b${v}\\b`).test(stripped)) referenced.add(v);
    }
  }
  const topLevel = defs.filter((v) => !referenced.has(v));
  // The chat library's root container is Card.
  return `${safe.trimEnd()}\nroot = Card([${(topLevel.length ? topLevel : defs).join(", ")}])`;
}

/** Only hand the Renderer a new snapshot when a complete statement (or more prose) has arrived. */
export function useStableText(raw: string, isStreaming: boolean): string {
  const [snapshot, setSnapshot] = useState({ text: "", statements: 0 });
  const enhanced = closeOrTruncateOpenString(raw);
  if (!isStreaming) return enhanced;

  const safe = truncateAtOpenString(raw);
  const statements = countCompleteStatements(safe);
  const newComplete = statements > snapshot.statements && chartDataRefsResolved(safe);
  const partialText = enhanced !== safe;
  if ((newComplete || partialText) && enhanced !== snapshot.text) {
    // Adjusting state while rendering: React re-renders this component at once.
    const next = { text: enhanced, statements: newComplete ? statements : snapshot.statements };
    setSnapshot(next);
    return next.text;
  }
  return snapshot.text;
}
