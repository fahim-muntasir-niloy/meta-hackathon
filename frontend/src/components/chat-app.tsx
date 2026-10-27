"use client";

import { Client, type Thread } from "@langchain/langgraph-sdk";
import { useStream } from "@langchain/react";
import type { ActionEvent } from "@openuidev/react-lang";
import { ThemeProvider, useThemeModePreference } from "@openuidev/react-ui";
import {
  AlertTriangle,
  Bug,
  CalendarCheck,
  CloudSun,
  Leaf,
  LogOut,
  MessageSquare,
  Moon,
  Plus,
  Sprout,
  Sun,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AssistantReply } from "@/components/assistant-reply";
import { Composer } from "@/components/composer";
import { ToolActivity } from "@/components/tool-activity";
import { UserMessage } from "@/components/user-message";
import { bnDigits } from "@/lib/bn";
import { API_URL, ASSISTANT_ID, PHONE_HEADER } from "@/lib/config";
import { decodeFormMessage, encodeFormMessage, flattenFormState } from "@/lib/form-message";
import { buildTurns } from "@/lib/turns";

const BRAND = { light: "#1f7a4d", dark: "#4cc38a" };

// Inter for Latin, Hind Siliguri for Bangla — also inside OpenUI-rendered replies.
const FONT_STACK = "var(--font-inter), var(--font-bangla), sans-serif";
const FONTS = { fontBody: FONT_STACK, fontHeading: FONT_STACK, fontLabel: FONT_STACK };

const STARTERS = [
  {
    icon: Leaf,
    title: "ধানের পাতায় দাগ",
    prompt: "আমার ধানের পাতায় চোখের মতো দাগ পড়ছে। আমি বগুড়ায় থাকি। কী করব?",
  },
  {
    icon: CloudSun,
    title: "এ সপ্তাহে মাঠের কাজ",
    prompt: "এ সপ্তাহে বগুড়ার আবহাওয়া কি ধানক্ষেতে কাজ করার জন্য ভালো?",
  },
  {
    icon: Bug,
    title: "বাদামি গাছফড়িং",
    prompt: "আমার ধানক্ষেতে বাদামি গাছফড়িং দেখা দিয়েছে। কীভাবে দমন করব?",
  },
  {
    icon: CalendarCheck,
    title: "কৃষি অফিসারের সাথে কথা",
    prompt: "আমি আমার এলাকার কৃষি অফিসারের সাথে একটি সেশন বুক করতে চাই।",
  },
];

export function ChatApp({ phone, onSignOut }: { phone: string; onSignOut: () => void }) {
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
        phone={phone}
        onSignOut={onSignOut}
        mode={mode}
        onToggleTheme={() => setPreference(mode === "dark" ? "light" : "dark")}
      />
    </ThemeProvider>
  );
}

type ChatProps = {
  phone: string;
  onSignOut: () => void;
  mode: "light" | "dark";
  onToggleTheme: () => void;
};

function Chat({ phone, onSignOut, mode, onToggleTheme }: ChatProps) {
  const headers = useMemo(() => ({ [PHONE_HEADER]: phone }), [phone]);
  const client = useMemo(() => new Client({ apiUrl: API_URL, defaultHeaders: headers }), [headers]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);

  const refreshThreads = useCallback(() => {
    client.threads
      .search({ limit: 30, sortBy: "updated_at", sortOrder: "desc" })
      .then(setThreads)
      .catch(() => setThreads([]));
  }, [client]);
  useEffect(refreshThreads, [refreshThreads]);

  const stream = useStream({
    apiUrl: API_URL,
    assistantId: ASSISTANT_ID,
    defaultHeaders: headers,
    threadId,
    onThreadId: (id) => {
      setThreadId(id);
      refreshThreads();
    },
    onCompleted: refreshThreads,
  });

  const turns = useMemo(() => buildTurns(stream.messages, stream.isLoading), [stream.messages, stream.isLoading]);
  const lastTurn = turns.at(-1);
  const waiting =
    stream.isLoading && (lastTurn?.kind === "user" || (lastTurn?.kind === "assistant" && !lastTurn.reply && !lastTurn.steps.some((s) => s.status === "running")));

  // A finished run must end with something to read; otherwise tell the farmer.
  const noReply =
    !stream.isLoading &&
    stream.error == null &&
    (lastTurn?.kind === "user" || (lastTurn?.kind === "assistant" && !lastTurn.reply));

  const send = useCallback(
    (text: string) => {
      void stream.submit({ messages: [{ type: "human", content: text }] });
    },
    [stream],
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

  return (
    <div className="shell">
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
          <span className="phone-chip" title="আপনার নম্বর">
            {bnDigits(phone)}
          </span>
          <button type="button" className="icon-btn" onClick={onToggleTheme} aria-label="থিম পরিবর্তন">
            {mode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button type="button" className="icon-btn" onClick={onSignOut} aria-label="নম্বর পরিবর্তন">
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
                  <UserMessage key={turn.id} text={turn.text} />
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
          <Composer onSend={send} onStop={() => void stream.stop()} isLoading={stream.isLoading} />
          <p className="disclaimer">পরামর্শটি BRRI / DAE নির্দেশিকা থেকে AI দিয়ে তৈরি। রাসায়নিক ব্যবহারের আগে স্থানীয় কৃষি অফিসারের সাথে কথা বলুন।</p>
        </div>
      </main>
    </div>
  );
}

function Welcome({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <section className="welcome">
      <span className="brand-mark brand-mark-lg" aria-hidden>
        <Sprout size={26} />
      </span>
      <h1>আসসালামু আলাইকুম! আজ আপনার ফসলের জন্য কী করতে পারি?</h1>
      <p>মাঠে যা দেখছেন তা লিখুন। আমি যাচাই করা নির্দেশিকা ও আবহাওয়া দেখে পরামর্শ দেব, দরকার হলে কৃষি অফিসারের সাথে সময় ঠিক করে দেব।</p>
      <div className="starters">
        {STARTERS.map(({ icon: Icon, title, prompt }) => (
          <button key={title} type="button" className="starter" onClick={() => onPick(prompt)}>
            <Icon size={18} />
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
  const text = typeof first?.content === "string" ? decodeFormMessage(first.content).label : "";
  return text ? (text.length > 48 ? `${text.slice(0, 47)}…` : text) : "নতুন কথোপকথন";
}
