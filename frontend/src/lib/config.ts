/** LangGraph Agent Server (`langgraph dev` in the repo root). */
export const API_URL = process.env.NEXT_PUBLIC_LANGGRAPH_API_URL ?? "http://localhost:2024";

/** Graph id from langgraph.json. */
export const ASSISTANT_ID = "krishi_advisor";

export const PHONE_HEADER = "X-Phone-Number";
