/**
 * Component library the agent writes openui-lang against.
 * `npm run generate:prompt` turns it into the backend system prompt
 * (src/meta_hackathon/prompts/openui_prompt.md) — rerun after changing this file.
 */
import { openuiChatLibrary } from "@openuidev/react-ui/genui-lib";
import { openuiChatPromptOptions } from "@openuidev/react-ui/genui-lib/prompt-options";
import type { PromptOptions } from "@openuidev/react-lang";
import { GeoMap, MapMarker } from "@/components/genui/map";

// Created at module scope: parsers memoize by library identity.
export const library = openuiChatLibrary.extend({
  components: { add: [{ component: GeoMap, slots: ["Card.children", "TabItem.content"] }, MapMarker] },
});

export const promptOptions: PromptOptions = {
  ...openuiChatPromptOptions,
  additionalRules: [
    ...(openuiChatPromptOptions.additionalRules ?? []),
    "Write all user-facing text in simple Bangla, including headings, buttons, form labels, placeholders and follow-ups, even if the farmer writes in English. Keep it short and practical.",
    "When advice comes from search_knowledgebase or search_internet, pass those results as Card sources and cite them inline as [1], [2]. Only set a source url if the tool result contains one; never invent URLs.",
    "For a diagnosis, lead with a Callout naming the likely problem and your confidence, then numbered Steps for what to do.",
    "When a tool returns an image URL, show it with Image or ImageBlock.",
    "Show weather as interactive charts, never as a Table. Use Tabs with two TabItems: \"আগামী ২৪ ঘণ্টা\" (labels from next_24h[].label: LineChart of temp_c, and BarChart of rain_chance_pct) and \"দৈনিক পূর্বাভাস\" (labels from forecast[].label: LineChart with two Series, সর্বোচ্চ and সর্বনিম্ন temperature, and BarChart of rain_chance_pct; add rain_mm as a second BarChart Series when it rains). Put the tab for the farmer's question first. Use the \"natural\" variant for lines, Bangla Series names and axis labels with units (°সে, %, মিমি). Before the charts, say in one Callout whether the coming hours/days suit the planned field work.",
    "Use a Map only when it shows something beyond the farmer's own location: two or more places (farmer and the officer's office after a booking, nearby markets, places being compared), or an area such as an outbreak zone (radiusKm). Never add a Map that is just a single pin of the farmer's area unless they ask to see it on a map. Reuse lat/lng from a get_weather result's place; call geocode_location only for places not located yet. Never guess coordinates. Label pins in Bangla.",
    "When you need details from the farmer (location, crop, booking date, session type), ask with a Form instead of plain questions.",
    // OpenUI's `required` validator treats Date objects as empty, so a required DatePicker can never submit.
    "Never put validation rules on a DatePicker.",
    "After a booking, show a confirmation Card with the officer, date/time, session type and booking id.",
    "End every reply with a FollowUpBlock of 2-3 short next questions the farmer is likely to ask.",
  ],
};
