"use client";

import { ArrowUp, Plus, Square, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { bnDigits } from "@/lib/bn";
import { MAX_IMAGES, toDataUrl } from "@/lib/images";

type Props = {
  onSend: (text: string, images: string[]) => void;
  onStop: () => void;
  isLoading: boolean;
};

export function Composer({ onSend, onStop, isLoading }: Props) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const addImages = async (files: Blob[]) => {
    const picked = files.filter((f) => f.type.startsWith("image/"));
    if (!picked.length) return;
    const room = MAX_IMAGES - images.length;
    setNotice(picked.length > room ? `একবারে সর্বোচ্চ ${bnDigits(MAX_IMAGES)}টি ছবি পাঠানো যাবে।` : null);
    if (room <= 0) return;
    try {
      const urls = await Promise.all(picked.slice(0, room).map(toDataUrl));
      setImages((prev) => [...prev, ...urls].slice(0, MAX_IMAGES));
    } catch {
      setNotice("ছবিটি খোলা যায়নি। অন্য একটি ছবি চেষ্টা করুন।");
    }
  };

  const canSend = (text.trim() !== "" || images.length > 0) && !isLoading;
  const send = () => {
    if (!canSend) return;
    onSend(text.trim(), images);
    setText("");
    setImages([]);
    setNotice(null);
  };

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      {images.length > 0 && (
        <div className="composer-attachments">
          {images.map((url, i) => (
            <div key={url} className="attachment">
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
              <img src={url} alt={`সংযুক্ত ছবি ${bnDigits(i + 1)}`} />
              <button
                type="button"
                className="attachment-remove"
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                aria-label="ছবি সরান"
              >
                <X size={12} strokeWidth={3} />
              </button>
            </div>
          ))}
        </div>
      )}
      {notice && <p className="composer-notice">{notice}</p>}
      <div className="composer-row">
        <button
          type="button"
          className="composer-attach"
          onClick={() => fileRef.current?.click()}
          disabled={images.length >= MAX_IMAGES}
          aria-label="ছবি যোগ করুন"
          title={`ছবি যোগ করুন (সর্বোচ্চ ${bnDigits(MAX_IMAGES)}টি)`}
        >
          <Plus size={18} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void addImages(Array.from(e.target.files ?? []));
            e.target.value = ""; // so picking the same file again still fires
          }}
        />
        <textarea
          ref={ref}
          rows={1}
          value={text}
          placeholder={images.length ? "ছবি সম্পর্কে কিছু লিখুন (ঐচ্ছিক)…" : "আপনার ফসলের সমস্যা লিখুন বা ছবি দিন…"}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.some((f) => f.type.startsWith("image/"))) {
              e.preventDefault();
              void addImages(files);
            }
          }}
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
          <button type="submit" className="composer-btn" disabled={!canSend} aria-label="পাঠান">
            <ArrowUp size={18} strokeWidth={2.4} />
          </button>
        )}
      </div>
    </form>
  );
}
