"use client";

import { AlertCircle, Check, ChevronDown, CircleSlash, Loader2 } from "lucide-react";
import { useState } from "react";
import { narrate } from "@/lib/narration";
import type { Step } from "@/lib/turns";

/** Timeline of what the agent is doing, one plain-language line per tool call. */
export function ToolActivity({ steps }: { steps: Step[] }) {
  if (!steps.length) return null;
  return (
    <ol className="activity" aria-label="কৃষিবন্ধু যা করেছে">
      {steps.map((step) => (
        <ActivityStep key={step.id} step={step} />
      ))}
    </ol>
  );
}

const STATUS_LABELS: Record<Step["status"], string> = {
  running: "চলছে",
  done: "সম্পন্ন",
  error: "সমস্যা হয়েছে",
  stopped: "থামানো হয়েছে",
};

function ActivityStep({ step }: { step: Step }) {
  const [open, setOpen] = useState(false);
  const { icon: Icon, title, detail } = narrate(step.name, step.args, step.status, step.result);
  const StatusIcon = { running: Loader2, done: Check, error: AlertCircle, stopped: CircleSlash }[step.status];

  return (
    <li className="activity-step" data-status={step.status}>
      <span className="activity-icon" aria-hidden>
        <Icon size={15} strokeWidth={2} />
      </span>
      <div className="activity-body">
        <button
          type="button"
          className="activity-title"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          disabled={step.status === "running"}
        >
          <span className={step.status === "running" ? "shimmer" : undefined}>{title}</span>
          <StatusIcon size={14} className="activity-status" aria-label={STATUS_LABELS[step.status]} />
          {step.status !== "running" && <ChevronDown size={14} className="activity-chevron" />}
        </button>
        {detail && <div className="activity-detail">{detail}</div>}
        {open && (
          <pre className="activity-raw">
            {JSON.stringify({ input: step.args, output: step.result }, null, 2)}
          </pre>
        )}
      </div>
    </li>
  );
}
