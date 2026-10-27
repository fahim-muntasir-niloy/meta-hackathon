/**
 * Turns raw tool calls into plain-language Bangla activity lines, e.g.
 * "বগুড়ার ৩ দিনের আবহাওয়ার পূর্বাভাস দেখছি" → "বগুড়ার আবহাওয়া দেখা হয়েছে".
 */
import type { LucideIcon } from "lucide-react";
import { BookOpenCheck, CalendarCheck, CloudSun, Globe, Wrench } from "lucide-react";
import { bnDateTime, bnDigits, term } from "./bn";

export type StepStatus = "running" | "done" | "error" | "stopped";

export type Narration = {
  icon: LucideIcon;
  title: string;
  detail?: string;
};

type Args = Record<string, unknown>;
type Narrator = (args: Args, status: StepStatus, result: unknown) => Narration;

const str = (v: unknown, fallback = "") => (typeof v === "string" && v.trim() ? v.trim() : fallback);
const quote = (v: unknown) => `“${str(v, "…")}”`;
const asArray = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v : []);

const narrators: Record<string, Narrator> = {
  search_knowledgebase: (args, status, result) => {
    const hits = asArray(result).filter((h) => h.id);
    if (status !== "done")
      return { icon: BookOpenCheck, title: `যাচাই করা BRRI / DAE নির্দেশিকায় ${quote(args.query)} খুঁজছি` };
    return {
      icon: BookOpenCheck,
      title: hits.length ? `${bnDigits(hits.length)}টি নির্দেশিকা পাওয়া গেছে` : "মিলে যায় এমন নির্দেশিকা পাওয়া যায়নি",
      detail: hits.map((h) => str(h.title)).join(" · ") || undefined,
    };
  },

  get_weather: (args, status, result) => {
    const place = str(args.location, "আপনার এলাকা");
    if (status !== "done")
      return { icon: CloudSun, title: `${place}-এর ${bnDigits(Number(args.days ?? 3))} দিনের আবহাওয়ার পূর্বাভাস দেখছি` };
    const days = asArray((result as Args | undefined)?.forecast);
    const labels = ["আজ", "আগামীকাল"];
    return {
      icon: CloudSun,
      title: `${place}-এর আবহাওয়া দেখা হয়েছে`,
      detail:
        days
          .slice(0, 2)
          .map((d, i) => `${labels[i]}: ${term(str(d.condition))}, বৃষ্টির সম্ভাবনা ${bnDigits(Number(d.rain_chance_pct))}%`)
          .join(" · ") || undefined,
    };
  },

  search_internet: (args, status, result) => {
    if (status !== "done") return { icon: Globe, title: `ইন্টারনেটে ${quote(args.query)} খুঁজছি` };
    return { icon: Globe, title: `ইন্টারনেট থেকে ${bnDigits(asArray(result).length)}টি ফলাফল পড়া হয়েছে` };
  },

  schedule_officer_session: (args, status, result) => {
    const kind = term(str(args.session_type, "session"));
    const place = str(args.location, "আপনার এলাকা");
    if (status !== "done") return { icon: CalendarCheck, title: `${place}-এর কৃষি কর্মকর্তার সাথে ${kind} বুক করছি` };
    const r = (result ?? {}) as Args;
    const officer = str((r.officer as Args | undefined)?.name, "কৃষি কর্মকর্তা");
    return {
      icon: CalendarCheck,
      title: `${officer}-এর সাথে ${kind} বুক হয়েছে`,
      detail: [str(r.slot) && bnDateTime(str(r.slot)), str(r.booking_id) && `বুকিং আইডি: ${r.booking_id}`]
        .filter(Boolean)
        .join(" · ") || undefined,
    };
  },
};

export function narrate(name: string, args: Args, status: StepStatus, result: unknown): Narration {
  const narration = (narrators[name] ?? fallback(name))(args, status, result);
  if (status === "error") return { ...narration, detail: "এই ধাপে একটি সমস্যা হয়েছে" };
  if (status === "stopped") return { ...narration, detail: "থামানো হয়েছে" };
  return narration;
}

const fallback =
  (name: string): Narrator =>
  (_args, status) => ({
    icon: Wrench,
    title: status === "done" ? `${name.replaceAll("_", " ")} ব্যবহার করা হয়েছে` : `${name.replaceAll("_", " ")} ব্যবহার করছি`,
  });
