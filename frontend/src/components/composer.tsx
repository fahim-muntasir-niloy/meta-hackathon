"use client";

import { ArrowUp, Square } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

type Props = {
  onSend: (text: string) => void;
  onStop: () => void;
  isLoading: boolean;
};

export function Composer({ onSend, onStop, isLoading }: Props) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const send = () => {
    const value = text.trim();
    if (!value || isLoading) return;
    onSend(value);
    setText("");
  };

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <textarea
        ref={ref}
        rows={1}
        value={text}
        placeholder="আপনার ফসলের সমস্যা লিখুন…"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        autoFocus
      />
      {isLoading ? (
        <button type="button" className="composer-btn" onClick={onStop} aria-label="থামান">
          <Square size={14} fill="currentColor" />
        </button>
      ) : (
        <button type="submit" className="composer-btn" disabled={!text.trim()} aria-label="পাঠান">
          <ArrowUp size={18} strokeWidth={2.4} />
        </button>
      )}
    </form>
  );
}
