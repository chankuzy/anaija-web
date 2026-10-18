"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Playback = { muted: boolean; toggleMute: () => void };
const Ctx = createContext<Playback | null>(null);

// Global mute, shared by video and slideshow audio. Starts muted: browsers block unmuted autoplay.
export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const [muted, setMuted] = useState(true);
  const toggleMute = useCallback(() => setMuted((m) => !m), []);
  const value = useMemo(() => ({ muted, toggleMute }), [muted, toggleMute]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayback(): Playback {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayback must be used inside <PlaybackProvider>");
  return v;
}
