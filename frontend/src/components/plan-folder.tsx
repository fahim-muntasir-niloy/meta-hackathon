"use client";

// Sidebar: every plan the farmer has (treatment and cultivation) in one folder,
// like the photo and booking folders; a plan opens in the pane beside the chat.

import { ChevronRight, ClipboardList, Sprout, Stethoscope } from "lucide-react";
import { useState } from "react";
import { stageLabel } from "@/components/case-pane";
import { bnDigits } from "@/lib/bn";
import type { CropCase } from "@/lib/cases";

export function PlanFolder({
  cases,
  openId,
  onOpen,
}: {
  cases: CropCase[];
  openId: string | null;
  onOpen: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="photo-folder plan-folder" data-open={open}>
      <button type="button" className="photo-folder-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <ChevronRight size={14} className="photo-folder-chevron" />
        <ClipboardList size={15} />
        <span>পরিকল্পনা</span>
        <span className="photo-folder-count">{bnDigits(cases.length)}</span>
      </button>
      {open &&
        (cases.length ? (
          <nav className="case-list" aria-label="পরিকল্পনা">
            {cases.map((c) => {
              const Icon = c.plan_type === "cultivation" ? Sprout : Stethoscope;
              const { done, total } = c.progress;
              return (
                <button
                  key={c.id}
                  type="button"
                  className="case-item"
                  aria-current={c.id === openId}
                  data-stage={c.stage}
                  data-type={c.plan_type}
                  onClick={() => onOpen(c.id === openId ? null : c.id)}
                >
                  <span className="case-item-title">
                    <Icon size={13} className="case-item-icon" />
                    {c.problem}
                  </span>
                  <span className="case-item-meta">
                    <span className="case-meter" aria-hidden>
                      <span style={{ width: `${total ? (100 * done) / total : 0}%` }} />
                    </span>
                    {c.stage === "in_treatment" ? `${bnDigits(done)}/${bnDigits(total)}` : stageLabel(c)}
                  </span>
                </button>
              );
            })}
          </nav>
        ) : (
          <p className="thread-empty">
            রোগের চিকিৎসা বা কোনো ফসল চাষের পরিকল্পনা করলে এখানে দিনে দিনে কাজের তালিকা থাকবে।
          </p>
        ))}
    </section>
  );
}
