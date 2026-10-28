"use client";

import { Renderer, type ActionEvent } from "@openuidev/react-lang";
import { memo } from "react";
import { library } from "@/lib/library";

/** Models sometimes wrap the program in a code fence; the renderer wants bare openui-lang. */
function stripFence(text: string) {
  return text.replace(/^\s*```[\w-]*\n?/, "").replace(/\n?```\s*$/, "");
}

const looksLikeOpenUI = (text: string) => /^\s*root\s*=/m.test(text);

type Props = {
  text: string;
  isStreaming: boolean;
  onAction: (event: ActionEvent) => void;
};

/** Renders the agent's openui-lang reply as live UI (cards, sources, forms, follow-ups). */
export const AssistantReply = memo(function AssistantReply({ text, isStreaming, onAction }: Props) {
  const program = stripFence(text);
  // Plain text replies (e.g. the model ignored the format) still read fine as prose.
  if (!isStreaming && !looksLikeOpenUI(program)) {
    return <div className="reply-plain">{program}</div>;
  }
  return (
    <div className="reply">
      <Renderer response={program} library={library} isStreaming={isStreaming} onAction={onAction} />
    </div>
  );
});
