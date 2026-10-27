/** Mirrors `normalize_phone` in src/meta_hackathon/utils/phone.py. Returns null if invalid. */
export function normalizePhone(raw: string): string | null {
  let phone = raw.replace(/[\s\-()]/g, "").replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6));
  if (/^01\d{9}$/.test(phone)) phone = `+880${phone.slice(1)}`;
  if (!/^\+?[1-9]\d{7,14}$/.test(phone)) return null;
  return phone.startsWith("+") ? phone : `+${phone}`;
}

const STORAGE_KEY = "krishi.phone";
const listeners = new Set<() => void>();
// Fallback when storage is unavailable (private mode): the session works, it just isn't remembered.
let memoryPhone: string | null = null;

export function loadPhone(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return memoryPhone;
  }
}

export function savePhone(phone: string | null) {
  memoryPhone = phone;
  try {
    if (phone) localStorage.setItem(STORAGE_KEY, phone);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Kept in memory only.
  }
  listeners.forEach((notify) => notify());
}

/** For useSyncExternalStore. */
export function subscribePhone(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}
