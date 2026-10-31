const configured = process.env.NEXT_PUBLIC_LANGGRAPH_API_URL ?? "http://localhost:2024";

/** LangGraph Agent Server (`langgraph dev` in the repo root). May be a path such
 * as "/api" when a reverse proxy serves both apps from one origin (docker
 * compose); it is made absolute in the browser for the SDK and the voice socket. */
export const API_URL =
  configured.startsWith("/") && typeof window !== "undefined" ? `${window.location.origin}${configured}` : configured;

/** Graph id from langgraph.json. */
export const ASSISTANT_ID = "krishi_advisor";

export const PHONE_HEADER = "X-Phone-Number";

/** Sent with every API call. ngrok's free tier answers browser requests with an
 * HTML warning page unless this header is present; other hosts ignore it. */
export const API_HEADERS = { "ngrok-skip-browser-warning": "1" };
