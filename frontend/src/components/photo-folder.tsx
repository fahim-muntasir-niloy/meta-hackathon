"use client";

import { ChevronRight, Folder, FolderOpen, MessageSquare } from "lucide-react";
import { useState } from "react";
import { bnDigits } from "@/lib/bn";
import type { GalleryImage } from "@/lib/gallery";

const dateLabel = new Intl.DateTimeFormat("bn-BD", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const caption = (img: GalleryImage) => img.labels.map((l) => `${l.label} (${bnDigits(l.count)})`).join(", ");

/** A folder in the sidebar with every photo KrishiBondhu marked up, across conversations. */
export function PhotoFolder({ images, onOpenThread }: { images: GalleryImage[]; onOpenThread: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState<GalleryImage | null>(null);
  const Icon = open ? FolderOpen : Folder;

  return (
    <section className="photo-folder" data-open={open}>
      <button type="button" className="photo-folder-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <ChevronRight size={14} className="photo-folder-chevron" />
        <Icon size={15} />
        <span>ছবি</span>
        <span className="photo-folder-count">{bnDigits(images.length)}</span>
      </button>
      {open &&
        (images.length ? (
          <div className="photo-grid">
            {images.map((img) => (
              <button key={img.url} type="button" onClick={() => setZoomed(img)} title={caption(img)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- annotated photos from /media */}
                <img src={img.url} alt={caption(img) || "চিহ্নিত ছবি"} loading="lazy" />
              </button>
            ))}
          </div>
        ) : (
          <p className="thread-empty">ফসলের ছবি পাঠালে কৃষিবন্ধু যেগুলোতে সমস্যা চিহ্নিত করবে, সেগুলো এখানে জমা থাকবে।</p>
        ))}
      {zoomed && (
        <div className="lightbox photo-lightbox" role="dialog" aria-label="ছবি" onClick={() => setZoomed(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- annotated photo */}
          <img src={zoomed.url} alt={caption(zoomed) || "চিহ্নিত ছবি"} />
          <div className="photo-lightbox-bar" onClick={(e) => e.stopPropagation()}>
            <span>
              {caption(zoomed)}
              <time dateTime={zoomed.created_at}>{dateLabel.format(new Date(zoomed.created_at))}</time>
            </span>
            {zoomed.thread_id && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  onOpenThread(zoomed.thread_id!);
                  setZoomed(null);
                }}
              >
                <MessageSquare size={13} />
                কথোপকথনে যান
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
