"use client";

import { AlertCircle, Check, ChevronRight, CircleCheck, CircleSlash, Code } from "lucide-react";
import { useState } from "react";
import { bnDigits } from "@/lib/bn";
import { narrate } from "@/lib/narration";
import type { Step } from "@/lib/turns";

/**
 * What the agent did this turn: running steps one line each as they run, the
 * finished ones folded into a single line that opens to list them.
 */
export function ToolActivity({ steps }: { steps: Step[] }) {
  const [open, setOpen] = useState(false);
  if (!steps.length) return null;
  const running = steps.filter((s) => s.status === "running");
  const finished = steps.filter((s) => s.status !== "running");
  const failed = finished.filter((s) => s.status === "error").length;

  return (
    <div className="activity" aria-label="কৃষিবন্ধু যা করেছে">
      {finished.length > 0 && (
        <div className="activity-done" data-open={open}>
          <button type="button" className="activity-summary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <ChevronRight size={13} className="activity-chevron" />
            <CircleCheck size={13} className="activity-ok" />
            {bnDigits(finished.length)}টি ধাপ সম্পন্ন
            {failed > 0 && <span className="activity-failed">· {bnDigits(failed)}টিতে সমস্যা</span>}
          </button>
          {open && (
            <ol className="activity-list">
              {finished.map((step) => (
                <FinishedStep key={step.id} step={step} />
              ))}
            </ol>
          )}
        </div>
      )}
      {running.map((step) => {
        const { icon: Icon, title } = narrate(step.name, step.args, step.status, step.result);
        return (
          <div key={step.id} className="activity-running" role="status">
            <span className="activity-icon" aria-hidden>
              <Icon size={14} strokeWidth={2} />
            </span>
            <span className="shimmer">{title}</span>
          </div>
        );
      })}
    </div>
  );
}

const STATUS_ICONS = { done: Check, error: AlertCircle, stopped: CircleSlash, running: Check };

function FinishedStep({ step }: { step: Step }) {
  const [raw, setRaw] = useState(false);
  const { icon: Icon, title, detail } = narrate(step.name, step.args, step.status, step.result);
  const StatusIcon = STATUS_ICONS[step.status];

  return (
    <li className="activity-step" data-status={step.status}>
      <span className="activity-icon" aria-hidden>
        <Icon size={13} strokeWidth={2} />
      </span>
      <div className="activity-body">
        <div className="activity-title">
          <span>{title}</span>
          <StatusIcon size={13} className="activity-status" />
          <button
            type="button"
            className="activity-raw-toggle"
            onClick={() => setRaw((r) => !r)}
            aria-expanded={raw}
            aria-label="টুলের ইনপুট ও আউটপুট"
            title="টুলের ইনপুট ও আউটপুট"
          >
            <Code size={12} />
          </button>
        </div>
        {detail && <div className="activity-detail">{detail}</div>}
        {raw && <pre className="activity-raw">{JSON.stringify({ input: step.args, output: step.result }, null, 2)}</pre>}
      </div>
    </li>
  );
}
