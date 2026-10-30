"use client";

import { Client, type Thread } from "@langchain/langgraph-sdk";
import { useStream } from "@langchain/react";
import type { ActionEvent } from "@openuidev/react-lang";
import { ThemeProvider, useThemeModePreference } from "@openuidev/react-ui";
import {
  AlertTriangle,
  Bug,
  CalendarCheck,
  ClipboardList,
  CloudSun,
  Leaf,
  LogOut,
  MessageSquare,
  Moon,
  Plus,
  Sprout,
  Sun,
  Target,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AssistantReply } from "@/components/assistant-reply";
import { CasePane, STAGE_LABELS } from "@/components/case-pane";
import { Composer, type ComposerHandle } from "@/components/composer";
import { IconTile, type Tone } from "@/components/icon-tile";
import { PhotoFolder } from "@/components/photo-folder";
import { PaneResizer, usePaneWidth } from "@/components/pane-resizer";
import { ToolActivity } from "@/components/tool-activity";
import { UserMessage } from "@/components/user-message";
import { bnDigits } from "@/lib/bn";
import { CASE_TOOLS, type CropCase, deleteCase, isCase, listCases, updateCase, updateStep } from "@/lib/cases";
import { API_HEADERS, API_URL, ASSISTANT_ID, PHONE_HEADER } from "@/lib/config";
import { type GalleryImage, listImages } from "@/lib/gallery";
import { decodeFormMessage, encodeFormMessage, flattenFormState, withDetails } from "@/lib/form-message";
import { contentImages, imageBlock } from "@/lib/images";
import { placeLabel, profileContext, type Profile } from "@/lib/profile";
import { buildTurns, type Step } from "@/lib/turns";

const BRAND = { light: "#1f7a4d", dark: "#4cc38a" };

// Inter for Latin, Hind Siliguri for Bangla — also inside OpenUI-rendered replies.
const FONT_STACK = "var(--font-inter), var(--font-bangla), sans-serif";
const FONTS = { fontBody: FONT_STACK, fontHeading: FONT_STACK, fontLabel: FONT_STACK };

const STARTERS: { icon: typeof Leaf; tone: Tone; title: string; prompt: string }[] = [
  {
    icon: Leaf,
    tone: "green",
    title: "ধানের পাতায় দাগ",
    prompt: "আমার ধানের পাতায় চোখের মতো দাগ পড়ছে। কী করব?",
  },
  {
    icon: CloudSun,
    tone: "cyan",
    title: "এ সপ্তাহে মাঠের কাজ",
    prompt: "এ সপ্তাহের আবহাওয়া কি ধানক্ষেতে কাজ করার জন্য ভালো?",
  },
  {
    icon: Bug,
    tone: "yellow",
    title: "বাদামি গাছফড়িং",
    prompt: "আমার ধানক্ষেতে বাদামি গাছফড়িং দেখা দিয়েছে। কীভাবে দমন করব?",
  },
  {
    icon: CalendarCheck,
    tone: "magenta",
    title: "কৃষি অফিসারের সাথে কথা",
    prompt: "আমি আমার এলাকার কৃষি অফিসারের সাথে একটি সেশন বুক করতে চাই।",
  },
];

export function ChatApp({ profile, onSignOut }: { profile: Profile; onSignOut: () => void }) {
  const { mode, setPreference } = useThemeModePreference();
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  return (
    <ThemeProvider
      mode={mode}
      lightTheme={{ ...FONTS, interactiveAccentDefault: BRAND.light, textBrand: BRAND.light }}
      darkTheme={{ ...FONTS, interactiveAccentDefault: BRAND.dark, textBrand: BRAND.dark }}
    >
      <Chat
        profile={profile}
        onSignOut={onSignOut}
        mode={mode}
        onToggleTheme={() => setPreference(mode === "dark" ? "light" : "dark")}
      />
    </ThemeProvider>
  );
}

type ChatProps = {
  profile: Profile;
  onSignOut: () => void;
  mode: "light" | "dark";
  onToggleTheme: () => void;
};

function Chat({ profile, onSignOut, mode, onToggleTheme }: ChatProps) {
  const { phone, name } = profile;
  const headers = useMemo(() => ({ ...API_HEADERS, [PHONE_HEADER]: phone }), [phone]);
  const client = useMemo(() => new Client({ apiUrl: API_URL, defaultHeaders: headers }), [headers]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);

  // The farmer's crop cases, and the one open in the tracker pane (messages are then about it).
  const [cases, setCases] = useState<CropCase[]>([]);
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  const openCase = cases.find((c) => c.id === openCaseId) ?? null;
  const [paneWidth, setPaneWidth] = usePaneWidth();
  const composerRef = useRef<ComposerHandle>(null);

  const context = useMemo(
    () => ({ ...profileContext(profile), ...(openCase ? { case_id: openCase.id } : {}) }),
    [profile, openCase],
  );

  const refreshThreads = useCallback(() => {
    client.threads
      .search({ limit: 30, sortBy: "updated_at", sortOrder: "desc" })
      .then(setThreads)
      .catch(() => setThreads([]));
  }, [client]);
  useEffect(refreshThreads, [refreshThreads]);

  const refreshCases = useCallback(() => {
    listCases(phone)
      .then(setCases)
      .catch(() => {
        // The tracker stays as it was; chat still works.
      });
  }, [phone]);
  useEffect(refreshCases, [refreshCases]);

  // Photos KrishiBondhu marked up, for the sidebar's photo folder.
  const [images, setImages] = useState<GalleryImage[]>([]);
  const refreshImages = useCallback(() => {
    listImages(phone)
      .then(setImages)
      .catch(() => {
        // The folder stays as it was; chat still works.
      });
  }, [phone]);
  useEffect(refreshImages, [refreshImages]);

  const upsertCase = useCallback((c: CropCase) => {
    setCases((prev) => [c, ...prev.filter((x) => x.id !== c.id)]);
  }, []);

  const stream = useStream({
    apiUrl: API_URL,
    assistantId: ASSISTANT_ID,
    defaultHeaders: headers,
    threadId,
    onThreadId: (id) => {
      setThreadId(id);
      refreshThreads();
    },
    onCompleted: () => {
      refreshThreads();
      refreshCases();
      refreshImages();
    },
  });

  const turns = useMemo(() => buildTurns(stream.messages, stream.isLoading), [stream.messages, stream.isLoading]);
  const lastTurn = turns.at(-1);
  const waiting =
    stream.isLoading && (lastTurn?.kind === "user" || (lastTurn?.kind === "assistant" && !lastTurn.reply && !lastTurn.steps.some((s) => s.status === "running")));

  // The newest case a tool returned opens the pane, once, if it came in during a run. Cases in
  // a thread's history may be out of date, so those come from /v1/cases instead.
  const latestCase = turns
    .flatMap((t) => (t.kind === "assistant" ? t.steps : []))
    .findLast((s) => s.status === "done" && CASE_TOOLS.has(s.name) && isCase(s.artifact));
  const [handledStep, setHandledStep] = useState<string | null>(null);
  if (latestCase && latestCase.id !== handledStep && isCase(latestCase.artifact)) {
    setHandledStep(latestCase.id);
    if (stream.isLoading) {
      upsertCase(latestCase.artifact);
      setOpenCaseId(latestCase.artifact.id);
    }
  }

  // A finished run must end with something to read; otherwise tell the farmer.
  const noReply =
    !stream.isLoading &&
    stream.error == null &&
    (lastTurn?.kind === "user" || (lastTurn?.kind === "assistant" && !lastTurn.reply));

  const send = useCallback(
    (text: string, images: string[] = []) => {
      // Photos go as image_url content blocks next to the text (Muse reads them directly).
      const content = images.length
        ? [...(text ? [{ type: "text" as const, text }] : []), ...images.map(imageBlock)]
        : text;
      // Phone comes from the auth identity; name, place and the open case go into the system
      // prompt. The Agent Server copies `configurable` into the run context (UserContext).
      void stream.submit({ messages: [{ type: "human", content }] }, { config: { configurable: context } });
    },
    [stream, context],
  );

  const onAction = useCallback(
    (event: ActionEvent) => {
      if (event.type === "open_url" && typeof event.params.url === "string") {
        window.open(event.params.url, "_blank", "noopener,noreferrer");
      } else if (event.type === "continue_conversation") {
        const label = String(event.params.message ?? event.humanFriendlyMessage ?? "").trim();
        if (label) send(encodeFormMessage(label, flattenFormState(event.formState)));
      }
    },
    [send],
  );

  // Keep the newest content in view while streaming, unless the reader scrolled up.
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [stream.messages, waiting]);

  const showCases = () => setOpenCaseId(openCaseId ? null : (cases[0]?.id ?? null));

  return (
    <div
      className={`shell${openCase ? " with-pane" : ""}`}
      style={openCase && paneWidth ? ({ "--pane-width": `${paneWidth}px` } as React.CSSProperties) : undefined}
    >
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <Sprout size={18} />
          </span>
          <div>
            <div className="brand-name">KrishiBondhu.AI</div>
            <div className="brand-sub">কৃষকের ডিজিটাল বন্ধু</div>
          </div>
        </div>
        <button type="button" className="new-chat" onClick={() => setThreadId(null)}>
          <Plus size={16} /> নতুন কথোপকথন
        </button>
        {cases.length > 0 && (
          <nav className="case-list" aria-label="চিকিৎসার পরিকল্পনা">
            <div className="sidebar-label">চিকিৎসার পরিকল্পনা</div>
            {cases.map((c) => (
              <button
                key={c.id}
                type="button"
                className="case-item"
                aria-current={c.id === openCaseId}
                data-stage={c.stage}
                onClick={() => setOpenCaseId(c.id === openCaseId ? null : c.id)}
              >
                <span className="case-item-title">{c.problem}</span>
                <span className="case-item-meta">
                  <span className="case-meter" aria-hidden>
                    <span style={{ width: `${c.progress.total ? (100 * c.progress.done) / c.progress.total : 0}%` }} />
                  </span>
                  {c.stage === "in_treatment"
                    ? `${bnDigits(c.progress.done)}/${bnDigits(c.progress.total)}`
                    : STAGE_LABELS[c.stage]}
                </span>
              </button>
            ))}
          </nav>
        )}
        <PhotoFolder images={images} onOpenThread={setThreadId} />
        <div className="sidebar-label">কথোপকথন</div>
        <nav className="thread-list" aria-label="কথোপকথন">
          {threads.length === 0 && <p className="thread-empty">আপনার কথোপকথনগুলো এখানে দেখা যাবে।</p>}
          {threads.map((t) => (
            <button
              key={t.thread_id}
              type="button"
              className="thread-item"
              aria-current={t.thread_id === threadId}
              onClick={() => setThreadId(t.thread_id)}
            >
              <MessageSquare size={14} />
              <span>{threadTitle(t)}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="phone-chip" title={placeLabel(profile)}>
            <span className="profile-name">{name}</span>
            {bnDigits(phone)}
          </span>
          <button type="button" className="icon-btn" onClick={onToggleTheme} aria-label="থিম পরিবর্তন">
            {mode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button type="button" className="icon-btn" onClick={onSignOut} aria-label="প্রোফাইল পরিবর্তন">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="mobile-header">
          <span className="brand-mark" aria-hidden>
            <Sprout size={16} />
          </span>
          <span className="brand-name">KrishiBondhu.AI</span>
          {cases.length > 0 && (
            <button type="button" className="icon-btn badge-btn" onClick={showCases} aria-label="চিকিৎসার পরিকল্পনা">
              <ClipboardList size={18} />
              <span className="badge">{bnDigits(cases.length)}</span>
            </button>
          )}
          <button type="button" className="icon-btn" onClick={() => setThreadId(null)} aria-label="নতুন কথোপকথন">
            <Plus size={18} />
          </button>
        </header>

        <div
          className="scroll"
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
        >
          <div className="thread">
            {turns.length === 0 && !stream.isThreadLoading ? (
              <Welcome onPick={send} />
            ) : (
              turns.map((turn, i) =>
                turn.kind === "user" ? (
                  <UserMessage key={turn.id} text={turn.text} images={turn.images} />
                ) : (
                  <div key={turn.id} className="assistant-turn">
                    <ToolActivity steps={turn.steps} />
                    {turn.reply && (
                      <AssistantReply
                        text={turn.reply}
                        isStreaming={stream.isLoading && i === turns.length - 1}
                        onAction={onAction}
                      />
                    )}
                    <CaseCards steps={turn.steps} cases={cases} openId={openCaseId} onOpen={setOpenCaseId} />
                  </div>
                ),
              )
            )}
            {waiting && <Thinking />}
            {stream.error != null && !stream.isLoading && <ErrorNote error={stream.error} />}
            {noReply && turns.length > 0 && !stream.isThreadLoading && (
              <Note>কোনো উত্তর পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।</Note>
            )}
          </div>
        </div>

        <div className="composer-wrap">
          {openCase && (
            <div className="focus-chip">
              <IconTile icon={Target} tone="green" size="s" />
              <span className="focus-label">যে বিষয়ে কথা হচ্ছে</span>
              <button type="button" className="focus-name" onClick={() => setOpenCaseId(openCase.id)}>
                {openCase.problem}
              </button>
              <button type="button" className="icon-btn" onClick={() => setOpenCaseId(null)} aria-label="এই পরিকল্পনা নিয়ে কথা বন্ধ করুন">
                <X size={14} />
              </button>
            </div>
          )}
          <Composer ref={composerRef} phone={phone} onSend={send} onStop={() => void stream.stop()} isLoading={stream.isLoading} />
          <p className="disclaimer">পরামর্শটি BRRI / DAE নির্দেশিকা থেকে AI দিয়ে তৈরি। রাসায়নিক ব্যবহারের আগে স্থানীয় কৃষি অফিসারের সাথে কথা বলুন।</p>
        </div>
      </main>

      {openCase && (
        <>
          <PaneResizer onResize={setPaneWidth} />
          <CasePane
            crop={openCase}
            cases={cases}
            busy={stream.isLoading}
            onSelect={setOpenCaseId}
            onClose={() => setOpenCaseId(null)}
            onAsk={(text, details) => send(withDetails(text, details))}
            onPhoto={(_crop, step) => composerRef.current?.pickPhotos(`"${step.title}": নতুন ছবি পাঠালাম। গাছ এখন কেমন?`)}
            onUpdateStep={async (crop, step, patch) => upsertCase(await updateStep(phone, crop.id, step.id, patch))}
            onUpdateCase={async (crop, patch) => upsertCase(await updateCase(phone, crop.id, patch))}
            onDelete={async (crop) => {
              await deleteCase(phone, crop.id);
              setCases((prev) => prev.filter((c) => c.id !== crop.id));
              setOpenCaseId(null);
            }}
          />
        </>
      )}
    </div>
  );
}

/** A link to each case a turn started or changed, under the reply. */
function CaseCards({
  steps,
  cases,
  openId,
  onOpen,
}: {
  steps: Step[];
  cases: CropCase[];
  openId: string | null;
  onOpen: (id: string) => void;
}) {
  const ids = [
    ...new Set(
      steps
        .filter((s) => s.status === "done" && (s.name === "start_crop_case" || s.name === "update_crop_case"))
        .map((s) => (isCase(s.artifact) ? s.artifact.id : String(s.args.case_id ?? "")))
        .filter(Boolean),
    ),
  ];
  return ids.map((id) => {
    const c = cases.find((x) => x.id === id);
    if (!c) return null;
    const open = id === openId;
    return (
      <button key={id} type="button" className="case-card" aria-pressed={open} onClick={() => onOpen(id)}>
        <IconTile icon={ClipboardList} tone="green" />
        <span>
          <strong>{c.problem}</strong>
          <span className="sub">
            {bnDigits(c.progress.total)}টির মধ্যে {bnDigits(c.progress.done)}টি ধাপ সম্পন্ন ·{" "}
            {open ? "পাশের প্যানেলে খোলা" : "সময়রেখা দেখুন"}
          </span>
        </span>
      </button>
    );
  });
}

function Welcome({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <section className="welcome">
      <span className="brand-mark brand-mark-lg" aria-hidden>
        <Sprout size={26} />
      </span>
      <h1>আসসালামু আলাইকুম! আজ আপনার ফসলের জন্য কী করতে পারি?</h1>
      <p>মাঠে যা দেখছেন তা লিখুন বা ছবি দিন। আমি সমস্যা চিনে চিকিৎসার পরিকল্পনা দিনে দিনে সাজিয়ে দেব, আর দরকার হলে কৃষি অফিসারের সাথে সময় ঠিক করে দেব।</p>
      <div className="starters">
        {STARTERS.map(({ icon, tone, title, prompt }) => (
          <button key={title} type="button" className="starter" onClick={() => onPick(prompt)}>
            <IconTile icon={icon} tone={tone} />
            <span className="starter-title">{title}</span>
            <span className="starter-prompt">{prompt}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Thinking() {
  return (
    <div className="thinking" role="status">
      <span className="dot" />
      <span className="dot" />
      <span className="dot" />
      <span className="shimmer">ভাবছি…</span>
    </div>
  );
}

function ErrorNote({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  const filtered = /content_policy|content management policy/i.test(message);
  const unreachable = /failed to fetch|networkerror|load failed|ECONNREFUSED/i.test(message);
  return (
    <Note>
      {filtered
        ? "এই বার্তাটি AI সেবাদাতার নিরাপত্তা ফিল্টারে আটকে গেছে। একটু অন্যভাবে লিখে আবার চেষ্টা করুন।"
        : unreachable
          ? `এজেন্ট সার্ভারের (${API_URL}) সাথে যোগাযোগ করা যাচ্ছে না। সার্ভার চালু আছে তো? (uv run meta-hackathon)`
          : "উত্তর দিতে গিয়ে একটি সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।"}
    </Note>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="error-note" role="alert">
      <AlertTriangle size={16} />
      <span>{children}</span>
    </div>
  );
}

function threadTitle(thread: Thread): string {
  const messages = (thread.values as { messages?: { type?: string; content?: unknown }[] } | null)?.messages ?? [];
  const first = messages.find((m) => m.type === "human");
  const raw = typeof first?.content === "string" ? first.content : textOf(first?.content);
  const text = decodeFormMessage(raw).label;
  if (!text && contentImages(first?.content).length) return "ছবি পাঠানো হয়েছে";
  return text ? (text.length > 48 ? `${text.slice(0, 47)}…` : text) : "নতুন কথোপকথন";
}

function textOf(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content.map((b) => (b && typeof b === "object" && b.type === "text" ? String(b.text ?? "") : "")).join(" ").trim();
}
