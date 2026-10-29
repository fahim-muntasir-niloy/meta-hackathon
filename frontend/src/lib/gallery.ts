/** The farmer's annotated photos from segment_image, newest first (src/meta_hackathon/gallery.py). */
import { API_URL, PHONE_HEADER } from "./config";

export type GalleryImage = {
  url: string;
  /** The conversation it was made in. */
  thread_id: string | null;
  /** What was marked on it. */
  labels: { label: string; count: number }[];
  created_at: string;
};

export async function listImages(phone: string): Promise<GalleryImage[]> {
  const res = await fetch(`${API_URL}/v1/images`, { headers: { [PHONE_HEADER]: phone } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()).images;
}
