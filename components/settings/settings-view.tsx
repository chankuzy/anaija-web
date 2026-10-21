"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { settingsApi, type ContentSettings } from "@/lib/api/settings";
import { useAuth } from "@/lib/auth/auth-context";
import { Footnote, Group, SectionLabel, SettingsPage, Tile, Toggle, useRequireAuth, useToast } from "./settings-kit";

export function SettingsView() {
  const router = useRouter();
  const ready = useRequireAuth();
  const { signOut } = useAuth();
  const { toast, show } = useToast();
  const [s, setS] = useState<ContentSettings | null>(null);

  useEffect(() => {
    if (!ready) return;
    const ac = new AbortController();
    settingsApi
      .content(ac.signal)
      .then((r) => {
        if (!ac.signal.aborted) setS(r);
      })
      .catch(() => {
        if (!ac.signal.aborted) show("Couldn't load your settings");
      });
    return () => ac.abort();
  }, [ready, show]);

  // Optimistic: flips instantly, reverts if the server says no.
  async function change(patch: Partial<ContentSettings>) {
    if (!s) return;
    const prev = s;
    setS({ ...s, ...patch });
    try {
      await settingsApi.setContent(patch);
    } catch (e) {
      setS(prev);
      show(e instanceof ApiError ? e.message : "Couldn't save");
    }
  }

  async function logout() {
    if (!window.confirm("Log out? You can always log back in with your Google account.")) return;
    try {
      await signOut();
      router.replace("/");
    } catch {
      show("Couldn't log out");
    }
  }

  return (
    <SettingsPage title="Settings" backHref="/me">
      <SectionLabel>Account</SectionLabel>
      <Group>
        <Tile icon="forbidden" label="Blocked accounts" href="/settings/blocked" />
      </Group>

      <div className="h-6" />
      <SectionLabel>Feed</SectionLabel>
      <Group>
        <Toggle
          icon="volumeOff"
          label="Start videos muted"
          value={s?.feed_start_muted ?? false}
          disabled={!s}
          onChange={(v) => void change({ feed_start_muted: v })}
        />
        <Toggle
          icon="play"
          label="Autoplay videos"
          value={s?.feed_autoplay_video ?? true}
          disabled={!s}
          onChange={(v) => void change({ feed_autoplay_video: v })}
        />
      </Group>
      <Footnote>Applies to videos in your Home feed. You can still mute or play any video yourself.</Footnote>

      <div className="h-6" />
      <SectionLabel>Sharing</SectionLabel>
      <Group>
        <Toggle
          icon="plus"
          label="Let others add my posts to stories"
          value={s?.allow_story_sharing ?? true}
          disabled={!s}
          onChange={(v) => void change({ allow_story_sharing: v })}
        />
      </Group>
      <Footnote>When this is on, anyone can add your posts and listings to their own story.</Footnote>

      <div className="h-6" />
      <SectionLabel>Support</SectionLabel>
      <Group>
        <Tile icon="questionCircle" label="Help Center" href="/settings/help" />
        <Tile icon="bug" label="Report a problem" href="/settings/report" />
      </Group>

      <div className="h-6" />
      <Group>
        <Tile icon="logout" label="Log out" danger onClick={() => void logout()} />
      </Group>

      <p className="pt-8 text-center text-supporting text-muted">Anaija web</p>
      {toast}
    </SettingsPage>
  );
}
