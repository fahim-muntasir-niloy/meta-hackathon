"use client";

import { ArrowRight, Sprout } from "lucide-react";
import { useState } from "react";
import { DIVISIONS } from "@/lib/bd-locations";
import { normalizePhone } from "@/lib/phone";
import type { Profile } from "@/lib/profile";

type Field = keyof Profile;
type Control = HTMLInputElement | HTMLSelectElement;

/** No real auth yet: the phone number is the user's identity. */
export function ProfileGate({ onSubmit }: { onSubmit: (profile: Profile) => void }) {
  const [values, setValues] = useState<Profile>({ name: "", area: "", district: "", division: "", phone: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const districts = DIVISIONS.find((d) => d.en === values.division)?.districts ?? [];

  const field = (key: Field) => ({
    id: key,
    value: values[key],
    "aria-invalid": errors[key] ? true : undefined,
    onChange: (e: React.ChangeEvent<Control>) => {
      const value = e.target.value;
      // A new division invalidates the chosen district.
      setValues((v) => ({ ...v, [key]: value, ...(key === "division" ? { district: "" } : {}) }));
      setErrors((err) => ({ ...err, [key]: undefined }));
    },
  });

  return (
    <main className="gate">
      <form
        className="gate-card"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const name = values.name.trim();
          const area = values.area.trim();
          const { division, district } = values;
          const phone = normalizePhone(values.phone);
          const next: typeof errors = {};
          if (!name) next.name = "আপনার নাম লিখুন";
          if (!division) next.division = "বিভাগ বেছে নিন";
          if (!district) next.district = "জেলা বেছে নিন";
          if (!area) next.area = "আপনার এলাকার নাম লিখুন";
          if (!phone) next.phone = "সঠিক মোবাইল নম্বর লিখুন, যেমন ০১৭১২৩৪৫৬৭৮";
          setErrors(next);
          if (phone && name && area && division && district) onSubmit({ name, area, district, division, phone });
        }}
      >
        <span className="brand-mark brand-mark-lg" aria-hidden>
          <Sprout size={26} />
        </span>
        <h1>KrishiBondhu.AI</h1>
        <p className="gate-sub">কৃষকের ডিজিটাল বন্ধু — ফসলের সমস্যা, আবহাওয়া আর কৃষি অফিসারের সাক্ষাৎ, এক চ্যাটেই।</p>

        <div className="gate-field">
          <label htmlFor="name">আপনার নাম</label>
          <input {...field("name")} autoComplete="name" placeholder="যেমন: আব্দুল করিম" autoFocus />
          {errors.name && <p className="gate-error">{errors.name}</p>}
        </div>

        <div className="gate-row">
          <div className="gate-field">
            <label htmlFor="division">বিভাগ</label>
            <select {...field("division")}>
              <option value="">বেছে নিন</option>
              {DIVISIONS.map((d) => (
                <option key={d.en} value={d.en}>
                  {d.bn}
                </option>
              ))}
            </select>
            {errors.division && <p className="gate-error">{errors.division}</p>}
          </div>

          <div className="gate-field">
            <label htmlFor="district">জেলা</label>
            <select {...field("district")} disabled={!values.division}>
              <option value="">{values.division ? "বেছে নিন" : "আগে বিভাগ"}</option>
              {districts.map((d) => (
                <option key={d.en} value={d.en}>
                  {d.bn}
                </option>
              ))}
            </select>
            {errors.district && <p className="gate-error">{errors.district}</p>}
          </div>
        </div>

        <div className="gate-field">
          <label htmlFor="area">এলাকা (গ্রাম / ইউনিয়ন / উপজেলা)</label>
          <input {...field("area")} autoComplete="address-level3" placeholder="যেমন: শিবগঞ্জ" />
          {errors.area && <p className="gate-error">{errors.area}</p>}
        </div>

        <div className="gate-field">
          <label htmlFor="phone">মোবাইল নম্বর</label>
          <input {...field("phone")} inputMode="tel" autoComplete="tel" placeholder="০১৭১২৩৪৫৬৭৮" />
          {errors.phone && <p className="gate-error">{errors.phone}</p>}
        </div>

        <button type="submit" className="gate-submit">
          শুরু করুন <ArrowRight size={18} />
        </button>
        <p className="gate-hint">আপনার কথোপকথন এই নম্বরে সংরক্ষিত থাকবে। নাম ও এলাকা দিয়ে পরামর্শ আপনার মতো করে সাজানো হবে।</p>
      </form>
    </main>
  );
}
