"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { settingsApi } from "@/lib/api/settings";
import { useAuth } from "@/lib/auth/auth-context";
import { isFocusedNow, useDocumentFocus } from "@/lib/feed/focus";

type Prefs = { startMuted?: boolean; autoplay?: boolean };
type Playback = {
  muted: boolean;
  toggleMute: () => void;
  forceMute: () => void;
  autoplay: boolean;
  setPrefs: (p: Prefs) => void;
  /** Tab visible and window focused. Nothing may play while this is false. */
  focused: boolean;
};
const Ctx = createContext<Playback | null>(null);

// Global mute, shared by video and slideshow audio. Guests start muted (browsers block unmuted autoplay);
// signed-in users get their saved "start muted" / "autoplay" feed settings (content-settings).
export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [muted, setMuted] = useState(true);
  const [autoplay, setAutoplay] = useState(true);
  const focused = useDocumentFocus();
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

  // Hard guarantee, independent of any component: a media element that starts while unfocused is stopped,
  // and losing focus pauses every audio/video on the page.
  useEffect(() => {
    const guard = (e: Event) => {
      if (e.target instanceof HTMLMediaElement && !isFocusedNow()) e.target.pause();
    };
    document.addEventListener("play", guard, true);
    return () => document.removeEventListener("play", guard, true);
  }, []);
  useEffect(() => {
    if (focused) return;
    document.querySelectorAll<HTMLMediaElement>("audio,video").forEach((el) => el.pause());
  }, [focused]);

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
    () => ({ muted, toggleMute, forceMute, autoplay, setPrefs, focused }),
    [muted, toggleMute, forceMute, autoplay, setPrefs, focused],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayback(): Playback {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayback must be used inside <PlaybackProvider>");
  return v;
}
