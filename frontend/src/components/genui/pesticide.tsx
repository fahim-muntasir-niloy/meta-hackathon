"use client";

// Pesticide choices as cards: the dose large, the registered brands, and how
// hazardous it is to the person spraying it (WHO class from
// find_registered_pesticides, src/meta_hackathon/hazards.py), on the same
// colour band as the label on the bottle.

import { defineComponent } from "@openuidev/react-lang";
import { CircleHelp, Droplets, Glasses, Hand, Info, ShieldAlert, ShieldCheck, Shirt, Skull, TriangleAlert } from "lucide-react";
import { z } from "zod";

const HAZARDS = ["Ia", "Ib", "II", "III", "U", "unknown"] as const;
type Hazard = (typeof HAZARDS)[number];

const LEVELS: Record<Hazard, { label: string; tone: string; icon: typeof Skull; step: number }> = {
  Ia: { label: "অত্যন্ত বিপজ্জনক", tone: "red", icon: Skull, step: 5 },
  Ib: { label: "খুব বিপজ্জনক", tone: "red", icon: Skull, step: 4 },
  II: { label: "মাঝারি বিপজ্জনক", tone: "yellow", icon: TriangleAlert, step: 3 },
  III: { label: "সামান্য বিপজ্জনক", tone: "blue", icon: Info, step: 2 },
  U: { label: "সাধারণ ব্যবহারে ঝুঁকি কম", tone: "green", icon: ShieldCheck, step: 1 },
  unknown: { label: "তথ্য নেই: প্যাকেটের রঙের দাগ দেখুন", tone: "grey", icon: CircleHelp, step: 0 },
};

export const PesticideCard = defineComponent({
  name: "PesticideCard",
  props: z.object({
    ingredient: z.string(),
    category: z.string(),
    hazard: z.enum(HAZARDS),
    dose: z.string(),
    doseLocal: z.string().optional(),
    mixing: z.string().optional(),
    brands: z.array(z.string()),
    hazardNote: z.string().optional(),
    tag: z.string().optional(),
  }),
  description:
    'One registered active ingredient from find_registered_pesticides. ingredient and dose exactly as returned (dose of the first example brand, e.g. "125 ml/ha"); category in Bangla (কীটনাশক / ছত্রাকনাশক / আগাছানাশক); hazard = human_hazard.who_class ("unknown" when null); doseLocal = the dose per bigha or per 10 L tank in Bangla, e.g. "বিঘা প্রতি ~১৭ মিলি"; mixing = how to mix and spray, one short Bangla sentence; brands = 1-3 "Brand · AP-123"; hazardNote = human_hazard.note when present; tag e.g. "সবচেয়ে বেশি পাওয়া যায়".',
  component: ({ props }) => {
    const level = LEVELS[props.hazard] ?? LEVELS.unknown;
    const Icon = level.icon;
    const brands = (props.brands ?? []).filter(Boolean).slice(0, 3);
    return (
      <article className={`pc pc-${level.tone}`}>
        <div className="pc-band" aria-hidden />
        <header className="pc-head">
          <div>
            <span className="pc-category">{props.category}</span>
            <h4>{props.ingredient}</h4>
          </div>
          {props.tag && <span className="pc-tag">{props.tag}</span>}
        </header>

        <div className="pc-dose">
          <Droplets size={18} aria-hidden />
          <div>
            <strong>{props.doseLocal || props.dose}</strong>
            {props.doseLocal && <span>নিবন্ধিত মাত্রা: {props.dose}</span>}
          </div>
        </div>
        {props.mixing && <p className="pc-mixing">{props.mixing}</p>}

        <div className="pc-hazard" title="WHO-র বিপদ শ্রেণি: যিনি স্প্রে করবেন তাঁর জন্য">
          <div className="pc-hazard-label">
            <Icon size={15} aria-hidden />
            <span>
              মানুষের জন্য: <b>{level.label}</b>
            </span>
            {props.hazard !== "unknown" && <span className="pc-who">WHO {props.hazard}</span>}
          </div>
          <div className="pc-meter" aria-hidden>
            {[1, 2, 3, 4, 5].map((s) => (
              <span key={s} data-on={s <= level.step} />
            ))}
          </div>
          {props.hazardNote && (
            <p className="pc-note">
              <ShieldAlert size={13} aria-hidden /> {props.hazardNote}
            </p>
          )}
        </div>

        {brands.length > 0 && (
          <div className="pc-brands">
            {brands.map((b) => (
              <span key={b}>{b}</span>
            ))}
          </div>
        )}
        <footer className="pc-ppe">
          <span>
            <Hand size={13} aria-hidden /> গ্লাভস
          </span>
          <span>
            <Glasses size={13} aria-hidden /> চশমা ও মাস্ক
          </span>
          <span>
            <Shirt size={13} aria-hidden /> লম্বা জামা
          </span>
        </footer>
      </article>
    );
  },
});

export const PesticideCards = defineComponent({
  name: "PesticideCards",
  props: z.object({
    items: z.array(PesticideCard.ref),
    title: z.string().optional(),
  }),
  description: "1-3 registered pesticide choices side by side, the most widely available first.",
  component: ({ props, renderNode }) => (
    <section className="pc-block">
      {props.title && <div className="pc-title">{props.title}</div>}
      <div className="pc-grid">{renderNode(props.items)}</div>
    </section>
  ),
});
