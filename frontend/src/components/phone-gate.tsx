"use client";

import { ArrowRight, Sprout } from "lucide-react";
import { useState } from "react";
import { normalizePhone } from "@/lib/phone";

/** No real auth yet: the phone number is the user's identity. */
export function PhoneGate({ onSubmit }: { onSubmit: (phone: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="gate">
      <form
        className="gate-card"
        onSubmit={(e) => {
          e.preventDefault();
          const phone = normalizePhone(value);
          if (!phone) return setError("সঠিক মোবাইল নম্বর লিখুন, যেমন ০১৭১২৩৪৫৬৭৮");
          onSubmit(phone);
        }}
      >
        <span className="brand-mark brand-mark-lg" aria-hidden>
          <Sprout size={26} />
        </span>
        <h1>KrishiBondhu.AI</h1>
        <p className="gate-sub">কৃষকের ডিজিটাল বন্ধু — ফসলের সমস্যা, আবহাওয়া আর কৃষি অফিসারের সাক্ষাৎ, এক চ্যাটেই।</p>
        <label htmlFor="phone">মোবাইল নম্বর</label>
        <div className="gate-input">
          <input
            id="phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="০১৭১২৩৪৫৬৭৮"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            autoFocus
          />
          <button type="submit" aria-label="এগিয়ে যান">
            <ArrowRight size={18} />
          </button>
        </div>
        {error ? <p className="gate-error">{error}</p> : <p className="gate-hint">আপনার কথোপকথন এই নম্বরে সংরক্ষিত থাকবে।</p>}
      </form>
    </main>
  );
}
