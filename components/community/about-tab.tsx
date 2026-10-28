"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMessages } from "@/components/messaging/messages-context";
import { Group, Toggle, useToast } from "@/components/settings/settings-kit";
import { Avatar } from "@/components/ui/avatar";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { communitiesApi, type CommunityDetail } from "@/lib/api/communities";
import { confirmDialog } from "@/lib/ui/dialog";
import { Chip, DesigBadge, Label, ROLE_LABEL, categoryLabel, messageOf, shareLink, siteUrl, useFetch } from "./kit";
import { ManageSheet } from "./manage-sheet";
import { MembersSheet } from "./members-sheet";

const JOIN_TEXT = { open: "Anyone can join instantly.", request: "Joining needs approval from a moderator.", invite: "Joining needs an invitation link." };

export function AboutTab({ c, reload }: { c: CommunityDetail; reload: () => void }) {
  const router = useRouter();
  const { reloadInbox } = useMessages();
  const { toast, show } = useToast();
  const [sheet, setSheet] = useState<"members" | "manage" | null>(null);
  const prefs = useFetch(c.is_member ? `prefs:${c.id}` : null, () => communitiesApi.prefs(c.id));

  async function leave() {
    if (!(await confirmDialog({ title: `Leave ${c.name}?`, message: "You'll lose access to its chat and library.", confirmLabel: "Leave", danger: true }))) return;
    try {
      await communitiesApi.leave(c.id);
      reloadInbox();
      router.push("/communities");
    } catch (e) {
      show(messageOf(e));
    }
  }
  async function setPref(body: { chat_notify?: string; announce_notify?: boolean }) {
    try {
      await communitiesApi.setPrefs(c.id, body);
      prefs.reload();
      reloadInbox();
    } catch (e) {
      show(messageOf(e));
    }
  }
  async function share() {
    const r = await shareLink(`${siteUrl()}/c/${c.slug}`, c.name);
    if (r === "copied") show("Link copied");
  }

  const details = [c.course_code, c.department, c.level && `${c.level} level`, c.academic_session, c.faculty].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <section>
        {c.description ? <p className="whitespace-pre-wrap px-1 text-body leading-[1.55] text-fg/90">{c.description}</p> : <p className="px-1 text-secondary text-muted">No description yet.</p>}
        <div className="mt-3 flex flex-wrap gap-2 px-1">
          <span className="rounded-pill bg-surface-interactive px-3 py-1.5 text-supporting font-semibold text-fg">{categoryLabel(c.category)}</span>
          {details.map((d) => (
            <span key={d} className="rounded-pill bg-surface-interactive px-3 py-1.5 text-supporting font-semibold text-fg">{d}</span>
          ))}
        </div>
      </section>

      <section className="rounded-[20px] bg-surface-subtle p-4">
        <p className="text-[15px] font-bold text-fg">{JOIN_TEXT[c.join_policy]}</p>
        <p className="mt-1 text-secondary leading-[1.45] text-muted">
          {c.discoverability === "listed" ? "Appears in search." : "Unlisted: only people with the link can find it."}{" "}
          {c.read_policy === "public_preview" ? "Non-members can read the feed. Chat and Library are members-only." : "Everything is members-only."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void share()} className={buttonClass("outline", "h-10 px-4")}>
            <Icon name="share" className="size-4" />
            Share community link
          </button>
          {c.is_member && (
            <button type="button" onClick={() => setSheet("members")} className={buttonClass("outline", "h-10 px-4")}>
              <Icon name="usersGroupRounded" className="size-4" />
              Members
            </button>
          )}
          {c.can.moderate && (
            <button type="button" onClick={() => setSheet("manage")} className={buttonClass("primary", "h-10 px-4")}>
              <Icon name="settings" className="size-4" />
              Manage
            </button>
          )}
        </div>
        <p className="mt-3 text-supporting leading-[1.4] text-muted">The community link only opens its page. Joining still follows the policy above.</p>
      </section>

      {c.rules.length > 0 && (
        <section>
          <Label>Rules</Label>
          <ol className="space-y-2 rounded-[20px] bg-surface-subtle p-4">
            {c.rules.map((r, i) => (
              <li key={i} className="flex gap-3 text-body leading-[1.45] text-fg/90">
                <span className="w-5 shrink-0 text-right font-bold text-muted">{i + 1}</span>
                <span>{r.text}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {c.staff.length > 0 && (
        <section>
          <Label>Leadership</Label>
          <div className="space-y-2">
            {c.staff.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-[20px] bg-surface-subtle p-3.5">
                <Avatar url={s.avatar} name={s.name} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-fg">{s.name}</p>
                  <p className="truncate text-supporting text-muted">@{s.username} · {ROLE_LABEL[s.role]}</p>
                  {s.designations.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {s.designations.map((d, i) => <DesigBadge key={i} d={d} />)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 px-2 text-supporting leading-[1.4] text-muted">Titles like Class Representative are set by this community&apos;s admins. They are not an endorsement by Anaija or a school.</p>
        </section>
      )}

      {c.links.length > 0 && (
        <section>
          <Label>Links</Label>
          <div className="space-y-2">
            {c.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-3 rounded-[20px] bg-surface-subtle p-3.5 text-[15px] font-semibold text-fg hover:bg-surface-interactive">
                <Icon name="link" className="size-5 text-muted" />
                <span className="truncate">{l.label}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {c.is_member && prefs.data && (
        <section>
          <Label>Your notifications</Label>
          <p className="px-1 pb-2 text-secondary text-muted">Chat alerts</p>
          <div className="flex gap-2">
            {(["all", "mentions", "none"] as const).map((m) => (
              <Chip key={m} active={prefs.data?.chat_notify === m} onClick={() => void setPref({ chat_notify: m })}>
                {m === "all" ? "Every message" : m === "mentions" ? "Mentions" : "Off"}
              </Chip>
            ))}
          </div>
          <div className="mt-3">
            <Group>
              <Toggle icon="bell" label="Announcements and live sessions" value={prefs.data.announce_notify} onChange={(v) => void setPref({ announce_notify: v })} />
            </Group>
          </div>
        </section>
      )}

      {c.is_member && c.my_role !== "owner" && (
        <button type="button" onClick={() => void leave()} className="w-full rounded-full bg-surface-subtle py-3.5 text-[15px] font-bold text-danger hover:bg-surface-interactive">
          Leave community
        </button>
      )}

      {sheet === "members" && <MembersSheet c={c} onClose={() => setSheet(null)} />}
      {sheet === "manage" && <ManageSheet c={c} reload={reload} onClose={() => setSheet(null)} />}
      {toast}
    </div>
  );
}
