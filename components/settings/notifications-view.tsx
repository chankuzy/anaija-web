"use client";
import { SettingsGroupsSkeleton } from "@/components/ui/skeleton";

import { Icon } from "@/components/ui/icon";
import { ApiError } from "@/lib/api/client";
import { settingsApi, type NotifPrefs } from "@/lib/api/settings";
import { useCached } from "@/lib/cache/swr";
import { Footnote, Group, SectionLabel, SettingsPage, Toggle, useRequireAuth, useToast } from "./settings-kit";

const fmtHour = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h >= 12 ? "PM" : "AM"}`;

function HourRow({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (h: number) => void }) {
  return (
    <div className={`flex items-center gap-3.5 px-4 py-3 ${disabled ? "opacity-50" : ""}`}>
      <Icon name="clockCircle" className="size-6 shrink-0 text-white/75" />
      <span className="min-w-0 flex-1 text-[15px] font-semibold text-white">{label}</span>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-10 rounded-full bg-surface-interactive px-3 text-secondary font-bold text-white outline-none"
      >
        {Array.from({ length: 24 }, (_, h) => (
          <option key={h} value={h} className="bg-[#26262b]">
            {fmtHour(h)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function NotificationsView() {
  const ready = useRequireAuth();
  const { toast, show } = useToast();

  // Instant from cache, quiet revalidation behind it.
  const { data: p, error, refresh, mutate } = useCached<NotifPrefs>(
    ready ? "settings:notif-prefs" : null,
    () => settingsApi.notifPrefs(),
    { staleMs: 5 * 60_000 },
  );

  // Optimistic: flips immediately, reverts if the save fails.
  async function save(next: NotifPrefs) {
    const prev = p;
    mutate(() => next);
    try {
      await settingsApi.setNotifPrefs(next);
    } catch (e) {
      if (prev) mutate(() => prev);
      show(e instanceof ApiError ? e.message : "Couldn't save");
    }
  }

  let body;
  if (!p) {
    body = error ? (
      <div className="py-16 text-center">
        <p className="text-[17px] font-bold text-white">Couldn&apos;t load</p>
        <p className="mt-1 text-body text-muted">{error}</p>
        <button type="button" onClick={() => void refresh()} className="mt-5 h-10 rounded-full bg-brand px-5 text-secondary font-extrabold text-brand-fg">
          Try again
        </button>
      </div>
    ) : (
      <SettingsGroupsSkeleton />
    );
  } else {
    const on = p.push_enabled;
    const start = p.quiet_hours_start ?? 22;
    const end = p.quiet_hours_end ?? 7;
    body = (
      <>
        <SectionLabel>Push</SectionLabel>
        <Group>
          <Toggle icon="bell" label="Push notifications" value={on} onChange={(v) => void save({ ...p, push_enabled: v })} />
        </Group>

        <div className="h-6" />
        <SectionLabel>Notify me about</SectionLabel>
        <Group>
          <Toggle icon="heart" label="Likes" value={p.likes} disabled={!on} onChange={(v) => void save({ ...p, likes: v })} />
          <Toggle icon="chatLine" label="Comments" value={p.comments} disabled={!on} onChange={(v) => void save({ ...p, comments: v })} />
          <Toggle icon="userPlus" label="Follows" value={p.follows} disabled={!on} onChange={(v) => void save({ ...p, follows: v })} />
          <Toggle icon="letter" label="Messages" value={p.messages} disabled={!on} onChange={(v) => void save({ ...p, messages: v })} />
        </Group>
        <Footnote>Likes includes reposts and milestones. Comments includes replies and @mentions.</Footnote>

        <div className="h-6" />
        <SectionLabel>Privacy</SectionLabel>
        <Group>
          <Toggle icon="eyeClosed" label="Hide message previews" value={p.hide_message_preview} onChange={(v) => void save({ ...p, hide_message_preview: v })} />
        </Group>
        <Footnote>Notifications and Activity will say &quot;sent you a message&quot; instead of showing the text.</Footnote>

        <div className="h-6" />
        <SectionLabel>Quiet hours</SectionLabel>
        <Group>
          <Toggle
            icon="moon"
            label="Mute push at night"
            value={p.quiet_hours_enabled}
            disabled={!on}
            onChange={(v) => void save({ ...p, quiet_hours_enabled: v, quiet_hours_start: start, quiet_hours_end: end })}
          />
          {p.quiet_hours_enabled && (
            <>
              <HourRow label="From" value={start} disabled={!on} onChange={(h) => void save({ ...p, quiet_hours_start: h })} />
              <HourRow label="Until" value={end} disabled={!on} onChange={(h) => void save({ ...p, quiet_hours_end: h })} />
            </>
          )}
        </Group>
        {p.quiet_hours_enabled && <Footnote>Activity and unread counts still update. This only holds back the push notification.</Footnote>}
      </>
    );
  }

  return (
    <SettingsPage title="Notifications" backHref="/settings">
      {body}
      {toast}
    </SettingsPage>
  );
}
