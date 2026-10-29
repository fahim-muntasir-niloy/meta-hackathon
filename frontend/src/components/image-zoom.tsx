"use client";

import { ExternalLink, X } from "lucide-react";
import { useEffect } from "react";

export type ZoomedImage = { src: string; caption?: string; credit?: string; source?: string };

/** A photo full screen, with its caption and credit; a click outside or Esc closes it. */
export function ImageZoom({ image, onClose }: { image: ZoomedImage; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hasBar = image.caption || image.credit;
  return (
    <div className="lightbox image-zoom" role="dialog" aria-label={image.caption || "ছবি"} onClick={onClose}>
      <button type="button" className="image-zoom-close" onClick={onClose} aria-label="বন্ধ করুন">
        <X size={18} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- any image from a reply */}
      <img src={image.src} alt={image.caption || "ছবি"} />
      {hasBar && (
        <div className="image-zoom-bar" onClick={(e) => e.stopPropagation()}>
          {image.caption && <strong>{image.caption}</strong>}
          {image.credit && (
            <span>
              ছবি: {image.credit}
              {image.source && (
                <a href={image.source} target="_blank" rel="noopener noreferrer">
                  উইকিমিডিয়া কমন্স <ExternalLink size={11} />
                </a>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The image a click in a reply landed on: a tile that says what to zoom
 * (data-zoom-*), or a plain image. Links and OpenUI's gallery, which has its
 * own viewer, keep their behaviour.
 */
export function zoomTarget(target: EventTarget): ZoomedImage | null {
  if (!(target instanceof Element) || target.closest("a, .openui-gallery")) return null;
  const tile = target.closest<HTMLElement>("[data-zoom-src]");
  if (tile?.dataset.zoomSrc) {
    const { zoomSrc, zoomCaption, zoomCredit, zoomSource } = tile.dataset;
    return { src: zoomSrc, caption: zoomCaption, credit: zoomCredit, source: zoomSource };
  }
  const img = target.closest("img");
  return img?.src ? { src: img.src, caption: img.alt || undefined } : null;
}
