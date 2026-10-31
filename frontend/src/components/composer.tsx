"use client";

import { ArrowUp, Mic, Plus, Square, X } from "lucide-react";
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { bnDigits } from "@/lib/bn";
import { MAX_IMAGES, toDataUrl } from "@/lib/images";
import { canDictate, startDictation, type Dictation, type DictationError } from "@/lib/voice";

/** A press shorter than this is a tap: recording stays on until the next tap. */
const HOLD_MS = 350;

const VOICE_ERRORS: Record<DictationError, string> = {
  unsupported: "এই ব্রাউজারে মাইক্রোফোন চালু করা যায়নি।",
  denied: "কথা বলতে মাইক্রোফোন ব্যবহারের অনুমতি দিন।",
  failed: "কথাটি লেখায় রূপান্তর করা যায়নি। আবার চেষ্টা করুন।",
};

type Voice = { latched: boolean; finishing: boolean };

export type ComposerHandle = {
  /** Open the photo picker with `text` ready to send alongside, e.g. for a step of the plan. */
  pickPhotos: (text: string) => void;
};

type Props = {
  /** Identity for the speech-to-text socket. */
  phone: string;
  onSend: (text: string, images: string[]) => void;
  onStop: () => void;
  isLoading: boolean;
  ref?: Ref<ComposerHandle>;
};

export function Composer({ phone, onSend, onStop, isLoading, ref: handle }: Props) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [voice, setVoice] = useState<Voice | null>(null);
  const dictation = useRef<Dictation | null>(null);
  const pressedAt = useRef(0);
  const baseText = useRef(""); // what was typed before the farmer started talking

  useEffect(() => () => dictation.current?.cancel(), []);

  useImperativeHandle(handle, () => ({
    pickPhotos: (draft: string) => {
      setText(draft);
      fileRef.current?.click();
      ref.current?.focus();
    },
  }));

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

  const join = (spoken: string) => [baseText.current.trimEnd(), spoken.trim()].filter(Boolean).join(" ");

  const startVoice = () => {
    if (!canDictate()) {
      setNotice(VOICE_ERRORS.unsupported);
      return;
    }
    setNotice(null);
    baseText.current = text;
    setVoice({ latched: false, finishing: false });
    dictation.current = startDictation(phone, {
      onText: (spoken) => setText(join(spoken)),
      onDone: (result) => {
        dictation.current = null;
        setVoice(null);
        if ("error" in result) {
          setText(baseText.current);
          setNotice(VOICE_ERRORS[result.error]);
        } else {
          setText(join(result.text));
          if (!result.text.trim()) setNotice("কোনো কথা শোনা যায়নি। মাইক চেপে ধরে কথা বলুন।");
        }
        ref.current?.focus();
      },
    });
  };
  const stopVoice = () => {
    dictation.current?.stop();
    setVoice((v) => v && { ...v, finishing: true });
  };
  const cancelVoice = () => {
    dictation.current?.cancel();
    dictation.current = null;
    setVoice(null);
    setText(baseText.current);
  };

  const canSend = (text.trim() !== "" || images.length > 0) && !isLoading && !voice;
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
      {voice && (
        <p className="composer-voice-hint" aria-live="polite">
          <span className="rec-dot" />
          {voice.finishing ? "লেখা হচ্ছে…" : voice.latched ? "কথা শেষ হলে আবার মাইকে চাপুন" : "ছেড়ে দিলে কথাটি লেখা হয়ে যাবে"}
        </p>
      )}
      <div className="composer-row">
        {voice ? (
          <button type="button" className="composer-attach" onClick={cancelVoice} aria-label="রেকর্ডিং বাতিল করুন" title="বাতিল করুন">
            <X size={18} />
          </button>
        ) : (
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
        )}
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
          readOnly={!!voice}
          placeholder={voice ? "শুনছি…" : images.length ? "ছবি সম্পর্কে কিছু লিখুন (ঐচ্ছিক)…" : "আপনার ফসলের সমস্যা লিখুন বা ছবি দিন…"}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.some((f) => f.type.startsWith("image/"))) {
              e.preventDefault();
              void addImages(files);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && voice) {
              e.preventDefault();
              cancelVoice();
              return;
            }
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          autoFocus
        />
        <button
          type="button"
          className={`composer-mic${voice && !voice.finishing ? " recording" : ""}`}
          disabled={voice?.finishing}
          aria-label={voice ? "কথা বলা শেষ" : "চেপে ধরে কথা বলুন"}
          aria-pressed={!!voice}
          title="চেপে ধরে কথা বলুন, অথবা একবার চেপে শুরু করুন"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault(); // keep focus and stop text selection on long press
            if (voice) {
              if (voice.latched) stopVoice();
              return;
            }
            e.currentTarget.setPointerCapture(e.pointerId);
            pressedAt.current = performance.now();
            startVoice();
          }}
          onPointerUp={() => {
            if (!voice || voice.latched || voice.finishing) return;
            if (performance.now() - pressedAt.current < HOLD_MS) setVoice({ ...voice, latched: true });
            else stopVoice();
          }}
          onPointerCancel={() => voice && !voice.latched && stopVoice()}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => {
            if (e.detail !== 0) return; // pointer presses are handled above; this is Enter / Space
            if (!voice) {
              startVoice();
              setVoice({ latched: true, finishing: false });
            } else if (!voice.finishing) stopVoice();
          }}
        >
          <Mic size={18} />
        </button>
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
