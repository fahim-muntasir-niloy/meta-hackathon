/** Mirrors `normalize_phone` in src/meta_hackathon/utils/phone.py. Returns null if invalid. */
export function normalizePhone(raw: string): string | null {
  let phone = raw.replace(/[\s\-()]/g, "").replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6));
  if (/^01\d{9}$/.test(phone)) phone = `+880${phone.slice(1)}`;
  if (!/^\+?[1-9]\d{7,14}$/.test(phone)) return null;
  return phone.startsWith("+") ? phone : `+${phone}`;
}
