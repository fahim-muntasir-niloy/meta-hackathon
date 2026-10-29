"use client";

// The drag handle on the left edge of the right pane. The width it sets is
// remembered in this browser; double-click goes back to the default.

import { useCallback, useEffect, useState } from "react";

const KEY = "krishi.paneWidth";
const MIN = 380;
/** Room always left for the chat. */
const MIN_CHAT = 420;

const clampWidth = (w: number) => Math.round(Math.max(MIN, Math.min(w, window.innerWidth - MIN_CHAT)));

function stored(): number | null {
  try {
    const w = Number(localStorage.getItem(KEY));
    return w > 0 ? w : null;
  } catch {
    return null;
  }
}

function store(w: number | null) {
  try {
    if (w === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(w));
  } catch {
    // not remembered; the width still applies until reload
  }
}

/** The pane's width (null: the stylesheet's default) and a setter. */
export function usePaneWidth() {
  const [width, setWidth] = useState<number | null>(stored);

  // Keep the chat usable when the window shrinks.
  useEffect(() => {
    if (width === null) return;
    const fit = () => setWidth((w) => (w === null ? w : clampWidth(w)));
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [width === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback((w: number | null) => {
    const next = w === null ? null : clampWidth(w);
    setWidth(next);
    store(next);
  }, []);

  return [width, set] as const;
}

export function PaneResizer({ onResize }: { onResize: (width: number | null) => void }) {
  const [dragging, setDragging] = useState(false);

  const start = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    setDragging(true);
    document.body.classList.add("resizing");
    const move = (ev: PointerEvent) => onResize(window.innerWidth - ev.clientX);
    const end = () => {
      setDragging(false);
      document.body.classList.remove("resizing");
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };

  return (
    <div
      className={dragging ? "pane-resizer dragging" : "pane-resizer"}
      role="separator"
      aria-orientation="vertical"
      aria-label="প্যানেলের মাপ বদলান (ডাবল-ক্লিকে আগের মাপ)"
      title="টেনে মাপ বদলান · ডাবল-ক্লিকে আগের মাপ"
      tabIndex={0}
      onPointerDown={start}
      onDoubleClick={() => onResize(null)}
      onKeyDown={(e) => {
        const pane = e.currentTarget.nextElementSibling as HTMLElement | null;
        const now = pane?.offsetWidth ?? 600;
        if (e.key === "ArrowLeft") onResize(now + 32);
        if (e.key === "ArrowRight") onResize(now - 32);
      }}
    />
  );
}
