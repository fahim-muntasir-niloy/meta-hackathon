"use client";

import { useState } from "react";
import { bnDigits, term } from "@/lib/bn";
import { decodeFormMessage } from "@/lib/form-message";

export function UserMessage({ text, images = [] }: { text: string; images?: string[] }) {
  const { label, answers } = decodeFormMessage(text);
  const entries = Object.entries(answers);
  const [zoomed, setZoomed] = useState<string | null>(null);

  return (
    <div className="user-row">
      <div className="user-images-only">
        {images.length > 0 && (
          <div className="user-images">
            {images.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- data URLs from the thread
              <img key={i} src={url} alt={`পাঠানো ছবি ${bnDigits(i + 1)}`} onClick={() => setZoomed(url)} />
            ))}
          </div>
        )}
        {label && (
          <div className="user-bubble">
            <p>{label}</p>
            {entries.length > 0 && (
              <dl className="form-chips">
                {entries.map(([k, v]) => (
                  <div key={k} className="form-chip">
                    <dt>{term(k).replaceAll("_", " ")}</dt>
                    <dd>{term(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </div>
      {zoomed && (
        <div className="lightbox" role="dialog" aria-label="ছবি" onClick={() => setZoomed(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
          <img src={zoomed} alt="পাঠানো ছবি" />
        </div>
      )}
    </div>
  );
}
