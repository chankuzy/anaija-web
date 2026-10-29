"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMessages } from "@/components/messaging/messages-context";
import { Group, Toggle } from "@/components/settings/settings-kit";
import { communitiesApi, type CommunityDetail } from "@/lib/api/communities";
import { confirmDialog } from "@/lib/ui/dialog";
import { Chip, Label, MenuRow, Sheet, messageOf, shareLink, siteUrl, useFetch } from "./kit";
import { ManageSheet } from "./manage-sheet";
import { MembersSheet } from "./members-sheet";
import { SessionCreate } from "./session-create";

type View = "menu" | "members" | "manage" | "session";

// Everything that used to be scattered across buttons lives here.
export function CommunityMenu({ c, reload, onClose, onEditImage, onToast }: {
  c: CommunityDetail; reload: () => void; onClose: () => void; onEditImage: (k: "cover" | "avatar") => void; onToast: (m: string) => void;
}) {
  const router = useRouter();
  const { reloadInbox } = useMessages();
  const [view, setView] = useState<View>("menu");
  const prefs = useFetch(c.is_member ? `prefs:${c.id}` : null, () => communitiesApi.prefs(c.id));

  async function share() {
    const r = await shareLink(`${siteUrl()}/c/${c.slug}`, c.name);
    if (r === "copied") onToast("Link copied");
    onClose();
  }
  async function setPref(body: { chat_notify?: string; announce_notify?: boolean }) {
    try {
      await communitiesApi.setPrefs(c.id, body);
      prefs.reload();
      reloadInbox();
    } catch (e) {
      onToast(messageOf(e));
    }
  }
  async function leave() {
    if (!(await confirmDialog({ title: `Leave ${c.name}?`, message: "You'll lose access to its chat and library.", confirmLabel: "Leave", danger: true }))) return;
    try {
      await communitiesApi.leave(c.id);
      reloadInbox();
      router.push("/communities");
    } catch (e) {
      onToast(messageOf(e));
    }
  }

  if (view === "members") return <MembersSheet c={c} onClose={onClose} />;
  if (view === "manage") return <ManageSheet c={c} reload={reload} onClose={onClose} />;
  if (view === "session") return <SessionCreate c={c} onClose={onClose} onCreated={() => window.dispatchEvent(new Event("community:sessions"))} />;

  return (
    <Sheet title={c.name} onClose={onClose}>
      <div className="-mx-1">
        <MenuRow icon="share" label="Share community link" onClick={() => void share()} />
        {c.is_member && <MenuRow icon="usersGroupRounded" label="Members" hint={`${c.members_count} ${c.members_count === 1 ? "person" : "people"}`} onClick={() => setView("members")} />}
        {c.can.session && <MenuRow icon="eyeClosed" label="Anonymous session" hint="A temporary feed where posts have no names" onClick={() => setView("session")} />}
        {c.can.moderate && <MenuRow icon="settings" label="Manage" hint="Requests, invites, reports, settings" onClick={() => setView("manage")} />}
        {c.can.manage && (
          <>
            <MenuRow icon="gallery" label="Change cover" onClick={() => { onEditImage("cover"); onClose(); }} />
            <MenuRow icon="gallery" label="Change picture" onClick={() => { onEditImage("avatar"); onClose(); }} />
          </>
        )}
      </div>

      {c.is_member && prefs.data && (
        <>
          <Label>Notifications</Label>
          <div className="flex gap-2">
            {(["all", "mentions", "none"] as const).map((m) => (
              <Chip key={m} active={prefs.data?.chat_notify === m} onClick={() => void setPref({ chat_notify: m })}>
                {m === "all" ? "Every message" : m === "mentions" ? "Mentions" : "Chat off"}
              </Chip>
            ))}
          </div>
          <div className="mt-3">
            <Group>
              <Toggle icon="bell" label="Announcements and live sessions" value={prefs.data.announce_notify} onChange={(v) => void setPref({ announce_notify: v })} />
            </Group>
          </div>
        </>
      )}

      {c.is_member && c.my_role !== "owner" && (
        <div className="-mx-1 mt-3">
          <MenuRow icon="close" label="Leave community" danger onClick={() => void leave()} />
        </div>
      )}
    </Sheet>
  );
}
