"use client";

import { useSyncExternalStore } from "react";
import type { IconName } from "@/components/ui/icon";
import type { Moment, MomentStatus, MomentType } from "@/lib/api/moments";

// Each Moment has its own identity colour. Surfaces are tonal fills of it (no borders, no gradients).
export const TYPE_META: Record<MomentType, { title: string; tag: string; blurb: string; icon: IconName; color: string }> = {
  hot_seat: { title: "Hot Seat", tag: "Ask me anything", blurb: "Take the seat. Your community sends the questions, you choose what to answer.", icon: "star", color: "#ffb340" },
  verdict: { title: "Community Verdict", tag: "Vote first, then see", blurb: "Put a dilemma to the community. Everyone votes before the results appear.", icon: "check", color: "#4c8dff" },
  one_question: { title: "One Question", tag: "One prompt, everyone answers", blurb: "Ask one question and watch the answers roll in. The quickest Moment to start.", icon: "pen", color: "#ffd23f" },
  confession_drop: { title: "Confession Drop", tag: "Scheduled reveal", blurb: "Collect anonymous confessions, review them, then reveal on a countdown.", icon: "eyeClosed", color: "#9b8cff" },
  dept_war: { title: "Department Wars", tag: "Community vs community", blurb: "Challenge another community to trivia, riddles or a creative showdown.", icon: "usersGroupRounded", color: "#ff6b5c" },
};

export const tint = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

// One shared 1s clock for every countdown on screen; paused while the tab is hidden.
let nowVal = 0;
const subs = new Set<() => void>();
let timer: number | undefined;
function subscribe(cb: () => void) {
  subs.add(cb);
  if (subs.size === 1) {
    nowVal = Date.now();
    timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      nowVal = Date.now();
      subs.forEach((f) => f());
    }, 1000);
  }
  return () => {
    subs.delete(cb);
    if (subs.size === 0) window.clearInterval(timer);
  };
}
export const useNow = () => useSyncExternalStore(subscribe, () => nowVal, () => 0);

export function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const t = d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `today ${t}`;
  if (d.toDateString() === new Date(today.getTime() + 86_400_000).toDateString()) return `tomorrow ${t}`;
  return `${d.toLocaleDateString("en-NG", { day: "numeric", month: "short" })} ${t}`;
}
export function fmtLeft(ms: number): string {
  if (ms <= 0) return "0:00";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
export function toInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function revealPresets(): { label: string; value: string }[] {
  const now = new Date();
  const at8 = (add: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + add);
    d.setHours(20, 0, 0, 0);
    return d;
  };
  const out = [{ label: "In 1 hour", value: toInputValue(new Date(now.getTime() + 3_600_000)) }];
  if (at8(0).getTime() - now.getTime() > 20 * 60_000) out.push({ label: "Tonight 8 PM", value: toInputValue(at8(0)) });
  out.push({ label: "Tomorrow 8 PM", value: toInputValue(at8(1)) });
  return out;
}

export function statusLabel(type: MomentType, s: MomentStatus): string {
  switch (s) {
    case "draft": return "Challenge";
    case "scheduled": return "Upcoming";
    case "active": return "Live";
    case "closed": return type === "hot_seat" ? "Answering" : type === "confession_drop" ? "Revealing" : "Closed";
    case "completed": return "Ended";
    default: return "Cancelled";
  }
}

export const momentUrl = (code: string) => `${(process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "")}/m/${code}`;

// Share copy never names an anonymous host.
export function shareLine(m: Pick<Moment, "type" | "title" | "anonymous" | "host" | "community" | "config">): string {
  const t = m.title ?? "";
  const place = m.community.name;
  switch (m.type) {
    case "hot_seat":
      return m.host && !m.anonymous ? `${m.host.name ?? "Someone"} is in the Hot Seat in ${place}. Ask them anything.` : `Someone just started a Hot Seat in ${place}. Send a question.`;
    case "verdict":
      return `What's your verdict? ${t}`.trim();
    case "confession_drop": {
      const at = (m.config as { reveal_at?: string | null } | null)?.reveal_at;
      return at ? `${t || "Confession Drop"} in ${place} reveals ${fmtWhen(at)}. Submit yours anonymously.` : `A Confession Drop is happening in ${place}.`;
    }
    case "dept_war":
      return `Your department has been challenged by ${place}. ${t}`.trim();
    default:
      return `${t} Answer in ${place}.`.trim();
  }
}
