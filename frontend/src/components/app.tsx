"use client";

import { useSyncExternalStore } from "react";
import { ChatApp } from "@/components/chat-app";
import { PhoneGate } from "@/components/phone-gate";
import { loadPhone, savePhone, subscribePhone } from "@/lib/phone";

export function App() {
  // undefined on the server, so the gate doesn't flash before storage is read.
  const phone = useSyncExternalStore(subscribePhone, loadPhone, () => undefined);

  if (phone === undefined) return null;
  if (!phone) return <PhoneGate onSubmit={savePhone} />;
  return <ChatApp key={phone} phone={phone} onSignOut={() => savePhone(null)} />;
}
