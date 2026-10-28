import { DIVISIONS } from "@/lib/bd-locations";

/** Who the farmer is. No real auth yet: the phone number is the identity; the rest
 * rides along as run context so the agent can fill it in for every task. */
export type Profile = {
  phone: string;
  name: string;
  /** Village / union / upazila, free text (usually Bangla). */
  area: string;
  /** English names from bd-locations, e.g. "Bogura" / "Rajshahi". */
  district: string;
  division: string;
};

/** "বগুড়া (Bogura)": Bangla for the reply, English for the tools' place search. */
function label(en: string, list: { en: string; bn: string }[]) {
  const place = list.find((p) => p.en === en);
  return place ? `${place.bn} (${place.en})` : en;
}

/** Run context for the agent (see UserContext in src/meta_hackathon/agent/context.py). */
export function profileContext({ name, area, district, division }: Profile) {
  const div = DIVISIONS.find((d) => d.en === division);
  return { name, area, district: label(district, div?.districts ?? []), division: label(division, DIVISIONS) };
}

/** Short Bangla place line for the sidebar: "শিবগঞ্জ, বগুড়া". */
export function placeLabel({ area, district, division }: Profile) {
  const bn = DIVISIONS.find((d) => d.en === division)?.districts.find((d) => d.en === district)?.bn ?? district;
  return `${area}, ${bn}`;
}

const STORAGE_KEY = "krishi.profile";
const listeners = new Set<() => void>();
// Fallback when storage is unavailable (private mode): the session works, it just isn't remembered.
let memoryRaw: string | null = null;
// useSyncExternalStore needs a stable snapshot, so parse once per stored string.
let cached: { raw: string | null; profile: Profile | null } = { raw: null, profile: null };

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return memoryRaw;
  }
}

function parse(raw: string | null): Profile | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<Profile>;
    return p.phone && p.name && p.area && p.district && p.division
      ? { phone: p.phone, name: p.name, area: p.area, district: p.district, division: p.division }
      : null;
  } catch {
    return null;
  }
}

export function loadProfile(): Profile | null {
  const raw = readRaw();
  if (raw !== cached.raw) cached = { raw, profile: parse(raw) };
  return cached.profile;
}

export function saveProfile(profile: Profile | null) {
  const raw = profile ? JSON.stringify(profile) : null;
  memoryRaw = raw;
  try {
    if (raw) localStorage.setItem(STORAGE_KEY, raw);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Kept in memory only.
  }
  listeners.forEach((notify) => notify());
}

/** For useSyncExternalStore. */
export function subscribeProfile(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}
