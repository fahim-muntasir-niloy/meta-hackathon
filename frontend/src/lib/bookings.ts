/**
 * The farmer's sessions with an agriculture officer (src/meta_hackathon/bookings.py).
 * The agent books and moves them with tools; the cards and the sidebar read them from
 * the tool results and from /v1/bookings. The farmer can cancel from the card.
 */
import { bnDigits } from "./bn";
import { API_HEADERS, API_URL, PHONE_HEADER } from "./config";

export type SessionType = "phone_call" | "field_visit" | "office_visit";
export type BookingStatus = "confirmed" | "cancelled" | "completed";

export type Officer = {
  id: string;
  name_bn: string;
  designation_bn: string;
  designation_en: string;
  phone: string;
  district: string;
  district_bn: string;
  office_bn: string;
};

export type Booking = {
  id: string;
  status: BookingStatus;
  session_type: SessionType;
  /** Bangla, e.g. "মাঠ পরিদর্শন". */
  session_label: string;
  /** ISO with the +06:00 offset. */
  starts_at: string;
  ends_at: string;
  /** The session is over. */
  past: boolean;
  officer: Officer;
  case_id: string | null;
  thread_id: string | null;
  issue_summary: string;
  location: string;
  /** Who did what, newest last. */
  activity: { at: string; actor: "agent" | "farmer"; text: string }[];
  created_at: string;
  updated_at: string;
};

/** Tools whose result carries a booking as the ToolMessage artifact. */
export const BOOKING_TOOLS = new Set(["book_officer_session", "change_officer_booking"]);

export const isBooking = (value: unknown): value is Booking =>
  !!value && typeof value === "object" && typeof (value as Booking).id === "string" && !!(value as Booking).officer;

export const isUpcoming = (b: Booking) => b.status === "confirmed" && !b.past;

const dayFormat = (weekday: "long" | "short", month: "long" | "short") =>
  new Intl.DateTimeFormat("bn-BD", { timeZone: "Asia/Dhaka", weekday, day: "numeric", month });
const longDay = dayFormat("long", "long");
const shortDay = dayFormat("short", "short");
const hourMinute = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "numeric", minute: "numeric", hourCycle: "h23" });

/** "সকাল ১০টা", "বিকাল ৩টা ৩০ মিনিট" in Bangladesh time. */
function clock(date: Date): string {
  const [h, m] = hourMinute.format(date).split(":").map(Number);
  const part = h < 12 ? "সকাল" : h < 15 ? "দুপুর" : h < 18 ? "বিকাল" : "সন্ধ্যা";
  const hour = h > 12 ? h - 12 : h;
  return bnDigits(`${part} ${hour}টা${m ? ` ${m} মিনিট` : ""}`);
}

/** "রবিবার, ১ নভেম্বর, সকাল ১০টা" in Bangladesh time. */
export const bookingWhen = (b: Booking) => `${longDay.format(new Date(b.starts_at))}, ${clock(new Date(b.starts_at))}`;
export const bookingWhenShort = (b: Booking) => `${shortDay.format(new Date(b.starts_at))}, ${clock(new Date(b.starts_at))}`;

async function api<T>(phone: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}/v1/bookings${path}`, {
    ...init,
    headers: { ...API_HEADERS, ...init.headers, [PHONE_HEADER]: phone, ...(init.body ? { "Content-Type": "application/json" } : {}) },
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      // not JSON
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return res.json();
}

/** Upcoming first (soonest first), then past and cancelled ones. */
export async function listBookings(phone: string): Promise<Booking[]> {
  return (await api<{ bookings: Booking[] }>(phone, "")).bookings;
}

export function cancelBooking(phone: string, id: string, reason = "") {
  return api<Booking>(phone, `/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
}
