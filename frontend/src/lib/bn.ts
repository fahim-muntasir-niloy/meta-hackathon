/** Bangla display helpers. */

const numbers = new Intl.NumberFormat("bn-BD", { useGrouping: false });

/** 42 → "৪২"; leaves non-digits (e.g. "+880…") untouched. */
export function bnDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => numbers.format(Number(d)));
}

export function bnDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" });
}

/** Agent-side codes (tool args, form values) → Bangla labels. */
export const TERMS: Record<string, string> = {
  // Session types
  phone_call: "ফোন কল",
  field_visit: "মাঠ পরিদর্শন",
  office_visit: "অফিসে সাক্ষাৎ",
  // Weather conditions
  sunny: "রোদ",
  "partly cloudy": "আংশিক মেঘলা",
  cloudy: "মেঘলা",
  "light rain": "হালকা বৃষ্টি",
  "heavy rain": "ভারী বৃষ্টি",
  // Form field names
  location: "এলাকা",
  issue_summary: "সমস্যা",
  session_type: "সাক্ষাতের ধরন",
  preferred_date: "পছন্দের তারিখ",
  crop: "ফসল",
};

export const term = (key: string) => TERMS[key] ?? TERMS[key.toLowerCase().replaceAll("-", "_")] ?? key;
