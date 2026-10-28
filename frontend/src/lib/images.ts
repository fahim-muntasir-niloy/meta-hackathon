/** Photo attachments: up to MAX_IMAGES per message, sent as OpenAI-style
 * `image_url` content blocks with a JPEG data URL (Muse accepts these directly). */

export const MAX_IMAGES = 2;

// Phone photos are 3-8 MB; this keeps each one around 150-300 KB while symptoms stay legible.
const MAX_EDGE = 1280;
const QUALITY = 0.85;

export type ImageBlock = { type: "image_url"; image_url: { url: string } };

/** Downscale and re-encode a picked or pasted image as a JPEG data URL. */
export async function toDataUrl(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  // JPEG has no alpha: paint white under transparent PNGs/screenshots instead of black.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", QUALITY);
}

export const imageBlock = (url: string): ImageBlock => ({ type: "image_url", image_url: { url } });

/** Image URLs in a message's content, in either LangChain or OpenAI block format. */
export function contentImages(content: unknown): string[] {
  if (!Array.isArray(content)) return [];
  return content.flatMap((block) => {
    if (!block || typeof block !== "object") return [];
    const b = block as { type?: string; image_url?: string | { url?: string }; url?: string; base64?: string; mime_type?: string };
    if (b.type === "image_url") return [typeof b.image_url === "string" ? b.image_url : (b.image_url?.url ?? "")].filter(Boolean);
    if (b.type === "image") {
      if (b.url) return [b.url];
      if (b.base64) return [`data:${b.mime_type ?? "image/jpeg"};base64,${b.base64}`];
    }
    return [];
  });
}
