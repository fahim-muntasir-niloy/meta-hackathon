"use client";

import { useSyncExternalStore } from "react";
import { ChatApp } from "@/components/chat-app";
import { ProfileGate } from "@/components/profile-gate";
import { loadProfile, saveProfile, subscribeProfile } from "@/lib/profile";

export function App() {
  // undefined on the server, so the gate doesn't flash before storage is read.
  const profile = useSyncExternalStore(subscribeProfile, loadProfile, () => undefined);

  if (profile === undefined) return null;
  if (!profile) return <ProfileGate onSubmit={saveProfile} />;
  return <ChatApp key={profile.phone} profile={profile} onSignOut={() => saveProfile(null)} />;
}
