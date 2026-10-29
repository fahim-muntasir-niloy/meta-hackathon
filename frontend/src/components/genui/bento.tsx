"use client";

// Bento grid of reference photos: the first tile large, photos from
// Wikimedia Commons (search_images) with their credit. Tapping a tile opens
// the photo full size (see image-zoom.tsx).

import { defineComponent } from "@openuidev/react-lang";
import { useState } from "react";
import { z } from "zod";

export const BentoItem = defineComponent({
  name: "BentoItem",
  props: z.object({
    title: z.string(),
    description: z.string(),
    image: z.string(),
    credit: z.string(),
    source: z.string(),
    tag: z.string().optional(),
  }),
  description:
    'One photo tile of a BentoGrid. image, credit ("author, license") and source (the Commons page) come from one search_images result; title and description in Bangla.',
  component: () => null,
});

type Item = z.infer<typeof BentoItem.props>;

/** A stable gradient for a tile whose photo failed to load. */
function fallback(title: string) {
  let h = 0;
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `linear-gradient(135deg, hsl(${h} 45% 38%), hsl(${(h + 50) % 360} 50% 28%))`;
}

const https = (url?: string) => (url && /^https:\/\//.test(url) ? url : undefined);

function Tile({ item, index }: { item: Item; index: number }) {
  const [broken, setBroken] = useState(false);
  const image = broken ? undefined : https(item.image);
  const source = https(item.source);

  return (
    <figure
      className={`bento-tile t${index + 1}`}
      style={{ animationDelay: `${index * 70}ms` }}
      // Read by the reply's zoom handler.
      data-zoom-src={image}
      data-zoom-caption={item.title}
      data-zoom-credit={item.credit}
      data-zoom-source={source}
    >
      <div className="bento-bg" style={image ? undefined : { background: fallback(item.title) }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- remote Commons thumbnails */}
        {image && <img src={image} alt={item.title} loading="lazy" onError={() => setBroken(true)} />}
      </div>
      {item.tag && <span className="bento-tag">{item.tag}</span>}
      <figcaption className="bento-text">
        <strong>{item.title}</strong>
        <p>{item.description}</p>
      </figcaption>
      {image && item.credit && (
        <a className="bento-credit" href={source} target="_blank" rel="noopener noreferrer" title="উইকিমিডিয়া কমন্সে ছবিটি">
          © {item.credit}
        </a>
      )}
    </figure>
  );
}

export const BentoGrid = defineComponent({
  name: "BentoGrid",
  props: z.object({
    items: z.array(BentoItem.ref),
    title: z.string().optional(),
  }),
  description:
    "Bento-style grid of 1-6 reference photos from search_images, the most useful one first (it is shown large). Tapping a photo opens it full size.",
  component: ({ props }) => {
    // Items stream in one field at a time; only draw the ones with a title.
    const items = (props.items ?? [])
      .map((node) => node.props as Item)
      .filter((item) => item?.title)
      .slice(0, 6);
    if (!items.length) return null;
    return (
      <div className="bento-block">
        {props.title && <div className="bento-title">{props.title}</div>}
        <div className={`bento n${items.length}`}>
          {items.map((item, i) => (
            <Tile key={`${i}-${item.title}`} item={item} index={i} />
          ))}
        </div>
      </div>
    );
  },
});
