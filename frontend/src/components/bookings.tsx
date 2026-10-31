"use client";

// Officer sessions: a card under the reply that booked or moved one, and a
// list in the sidebar. Both show the same card; the farmer can call the
// officer or cancel (two taps, no browser dialog).

import { Building2, CalendarCheck, ChevronRight, ClipboardList, Phone, Tractor, X } from "lucide-react";
import { useState } from "react";
import { IconTile, type Tone } from "@/components/icon-tile";
import { bnDigits } from "@/lib/bn";
import { type Booking, type SessionType, bookingWhen, bookingWhenShort, isUpcoming } from "@/lib/bookings";

const SESSION_ICON: Record<SessionType, typeof Phone> = {
  phone_call: Phone,
  field_visit: Tractor,
  office_visit: Building2,
};

function status(b: Booking): { label: string; tone: Tone } {
  if (b.status === "cancelled") return { label: "বাতিল", tone: "grey" };
  if (b.past || b.status === "completed") return { label: "সম্পন্ন", tone: "grey" };
  return { label: "নিশ্চিত", tone: "green" };
}

export function BookingCard({
  booking: b,
  onCancel,
  onOpenCase,
  compact = false,
}: {
  booking: Booking;
  onCancel: (b: Booking) => Promise<void>;
  onOpenCase?: (caseId: string) => void;
  compact?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = status(b);
  const Icon = SESSION_ICON[b.session_type] ?? CalendarCheck;

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await onCancel(b);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`booking-card${compact ? " compact" : ""}`} data-status={isUpcoming(b) ? "upcoming" : "over"}>
      <header>
        <IconTile icon={Icon} tone={isUpcoming(b) ? "magenta" : "grey"} />
        <div className="booking-head">
          <strong>
            {b.session_label}: {b.officer.name_bn}
          </strong>
          <span className="sub">
            {b.officer.designation_bn} · {b.officer.office_bn}
          </span>
        </div>
        <span className={`booking-status ${s.tone}`}>{s.label}</span>
      </header>
      <time className="booking-when" dateTime={b.starts_at}>
        <CalendarCheck size={14} />
        {bookingWhen(b)}
      </time>
      {!compact && b.issue_summary && <p className="booking-summary">{b.issue_summary}</p>}
      <footer>
        <span className="booking-id">বুকিং নং {b.id}</span>
        {b.case_id && onOpenCase && (
          <button type="button" className="btn" onClick={() => onOpenCase(b.case_id!)}>
            <ClipboardList size={13} /> পরিকল্পনা
          </button>
        )}
        {isUpcoming(b) && (
          <>
            <a className="btn" href={`tel:${b.officer.phone}`}>
              <Phone size={13} /> {bnDigits(b.officer.phone)}
            </a>
            {confirming ? (
              <span className="booking-confirm">
                <button type="button" className="btn danger-soft" disabled={busy} onClick={cancel}>
                  {busy ? "বাতিল হচ্ছে…" : "হ্যাঁ, বাতিল করুন"}
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => setConfirming(false)}>
                  না
                </button>
              </span>
            ) : (
              <button type="button" className="btn" onClick={() => setConfirming(true)}>
                <X size={13} /> বাতিল
              </button>
            )}
          </>
        )}
      </footer>
      {error && <p className="booking-error">{error}</p>}
    </article>
  );
}

/** Sidebar: a folder like the photo folder; upcoming sessions inside, each opening its card. */
export function BookingList({
  bookings,
  onCancel,
  onOpenCase,
}: {
  bookings: Booking[];
  onCancel: (b: Booking) => Promise<void>;
  onOpenCase: (caseId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const upcoming = bookings.filter(isUpcoming);
  return (
    <section className="photo-folder booking-folder" data-open={open}>
      <button type="button" className="photo-folder-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <ChevronRight size={14} className="photo-folder-chevron" />
        <CalendarCheck size={15} />
        <span>অফিসারের সাক্ষাৎ</span>
        <span className="photo-folder-count">{bnDigits(upcoming.length)}</span>
      </button>
      {open &&
        (upcoming.length ? (
          <div className="booking-list">
            {upcoming.map((b) => {
              const Icon = SESSION_ICON[b.session_type] ?? CalendarCheck;
              const expanded = b.id === openId;
              return (
                <div key={b.id}>
                  <button
                    type="button"
                    className="booking-item"
                    aria-expanded={expanded}
                    onClick={() => setOpenId(expanded ? null : b.id)}
                  >
                    <Icon size={14} />
                    <span className="booking-item-text">
                      <span className="booking-item-title">{b.officer.name_bn}</span>
                      <span className="booking-item-meta">
                        {b.session_label} · {bookingWhenShort(b)}
                      </span>
                    </span>
                  </button>
                  {expanded && <BookingCard booking={b} onCancel={onCancel} onOpenCase={onOpenCase} compact />}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="thread-empty">কৃষি অফিসারের সাথে ফোনে কথা বা সাক্ষাতের সময় ঠিক করলে এখানে দেখা যাবে।</p>
        ))}
    </section>
  );
}
