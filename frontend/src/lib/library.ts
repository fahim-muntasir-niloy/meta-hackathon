/**
 * Component library the agent writes openui-lang against.
 * `npm run generate:prompt` turns it into the backend system prompt
 * (src/meta_hackathon/agent/openui_prompt.md) — rerun after changing this file.
 */
import { openuiChatLibrary } from "@openuidev/react-ui/genui-lib";
import { openuiChatPromptOptions } from "@openuidev/react-ui/genui-lib/prompt-options";
import type { PromptOptions } from "@openuidev/react-lang";

export const library = openuiChatLibrary;

export const promptOptions: PromptOptions = {
  ...openuiChatPromptOptions,
  additionalRules: [
    ...(openuiChatPromptOptions.additionalRules ?? []),
    "Write all user-facing text in simple Bangla, including headings, buttons, form labels, placeholders and follow-ups, even if the farmer writes in English. Keep it short and practical.",
    "When advice comes from search_knowledgebase or search_internet, pass those results as Card sources and cite them inline as [1], [2]. Only set a source url if the tool result contains one; never invent URLs.",
    "For a diagnosis, lead with a Callout naming the likely problem and your confidence, then numbered Steps for what to do.",
    "When a tool returns an image URL, show it with Image or ImageBlock.",
    "Show weather forecasts as a compact Table or LineChart, and say clearly whether the coming days are suitable for the planned field work.",
    "When you need details from the farmer (location, crop, booking date, session type), ask with a Form instead of plain questions.",
    // OpenUI's `required` validator treats Date objects as empty, so a required DatePicker can never submit.
    "Never put validation rules on a DatePicker.",
    "After a booking, show a confirmation Card with the officer, date/time, session type and booking id.",
    "End every reply with a FollowUpBlock of 2-3 short next questions the farmer is likely to ask.",
  ],
};
