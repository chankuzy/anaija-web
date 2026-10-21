"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { settingsApi } from "@/lib/api/settings";
import { useAuth } from "@/lib/auth/auth-context";

type Prefs = { startMuted?: boolean; autoplay?: boolean };
type Playback = {
  muted: boolean;
  toggleMute: () => void;
  forceMute: () => void;
  autoplay: boolean;
  setPrefs: (p: Prefs) => void;
};
const Ctx = createContext<Playback | null>(null);

// Global mute, shared by video and slideshow audio. Guests start muted (browsers block unmuted autoplay);
// signed-in users get their saved "start muted" / "autoplay" feed settings (content-settings).
export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [muted, setMuted] = useState(true);
  const [autoplay, setAutoplay] = useState(true);
  const touched = useRef(false); // once the viewer mutes/unmutes by hand, the saved default stops overriding

  useEffect(() => {
    if (status !== "authed") return;
    const ac = new AbortController();
    settingsApi
      .content(ac.signal)
      .then((s) => {
        if (ac.signal.aborted) return;
        setAutoplay(s.feed_autoplay_video);
        if (!touched.current) setMuted(s.feed_start_muted);
      })
      .catch(() => {});
    return () => ac.abort();
  }, [status]);

  const toggleMute = useCallback(() => {
    touched.current = true;
    setMuted((m) => !m);
  }, []);
  const forceMute = useCallback(() => setMuted(true), []);
  const setPrefs = useCallback((p: Prefs) => {
    if (p.autoplay !== undefined) setAutoplay(p.autoplay);
    if (p.startMuted !== undefined) setMuted(p.startMuted);
  }, []);

  const value = useMemo(
    () => ({ muted, toggleMute, forceMute, autoplay, setPrefs }),
    [muted, toggleMute, forceMute, autoplay, setPrefs],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayback(): Playback {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayback must be used inside <PlaybackProvider>");
  return v;
}
