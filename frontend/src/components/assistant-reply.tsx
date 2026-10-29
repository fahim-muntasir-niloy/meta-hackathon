"use client";

import { Renderer, type ActionEvent } from "@openuidev/react-lang";
import { memo, useMemo, useState } from "react";
import { ImageZoom, zoomTarget, type ZoomedImage } from "@/components/image-zoom";
import { library } from "@/lib/library";
import { buildProgressiveRoot, looksLikeOpenUI, sanitizeIdentifiers, stripCodeFence, useStableText } from "@/lib/progressive";

type Props = {
  text: string;
  isStreaming: boolean;
  onAction: (event: ActionEvent) => void;
};

/** Renders the agent's openui-lang reply as live UI (cards, sources, forms, follow-ups). */
export const AssistantReply = memo(function AssistantReply({ text, isStreaming, onAction }: Props) {
  const raw = useMemo(() => sanitizeIdentifiers(stripCodeFence(text)), [text]);
  const isProgram = looksLikeOpenUI(raw);
  // While streaming, the Renderer only gets a new snapshot once a whole statement is in,
  // so charts never see half-written data.
  const stable = useStableText(isProgram ? raw : "", isStreaming);
  const program = useMemo(() => buildProgressiveRoot(stable), [stable]);
  const [zoomed, setZoomed] = useState<ZoomedImage | null>(null);

  // Plain text replies (e.g. the model ignored the format) still read fine as prose; the first
  // tokens of a program ("root = C") are held back until it is clear which one it is.
  if (!isProgram) {
    const programStart = isStreaming && /^[a-zA-Z][a-zA-Z0-9_]*\s*(=\s*\S{0,2})?$/.test(raw);
    return programStart ? null : <div className="reply-plain">{raw}</div>;
  }
  if (!program) return null;
  return (
    <>
      <div
        className="reply"
        onClick={(e) => {
          const target = zoomTarget(e.target);
          if (target) setZoomed(target);
        }}
      >
        <Renderer response={program} library={library} isStreaming={isStreaming} onAction={onAction} />
      </div>
      {/* Outside the reply, so clicks in it do not bubble back into the zoom handler. */}
      {zoomed && <ImageZoom image={zoomed} onClose={() => setZoomed(null)} />}
    </>
  );
});
