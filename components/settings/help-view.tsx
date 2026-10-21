"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Group, SectionLabel, SettingsPage } from "./settings-kit";

const SECTIONS: { title: string; items: [string, string][] }[] = [
  {
    title: "Getting started",
    items: [
      ["How do I sign in?", "Anaija uses Google sign-in. Tap Continue with Google and pick your account. There is no password to remember."],
      ["How do I change my name, bio or photo?", "Open your profile and tap Edit Profile. You can update your name, username, tagline, bio, location, links, avatar and cover there."],
    ],
  },
  {
    title: "Posting",
    items: [
      ["Can I pin a post to my profile?", "Yes. Long-press one of your posts on your profile to pin or unpin it. A pinned post shows first on your Posts tab."],
      ["Why is my post still processing?", "Photos and videos are optimised before they appear in the feed. This normally takes a short while. If a post never shows up, send us a report from Settings."],
    ],
  },
  {
    title: "Marketplace",
    items: [
      ["How do I sell something?", "Tap Create, add photos, then switch the post to a listing and fill in the price and details. Buyers contact you through chat."],
      ["Meeting a buyer or seller safely", "Meet in busy, well-lit campus spots and in daylight where you can. Check the item before you pay, avoid paying in advance for something you have not seen, and tell a friend where you are going."],
      ["Marking an item sold or reserved", "Open your listing and use its options to mark it Reserved or Sold, so buyers know where it stands."],
    ],
  },
  {
    title: "Account and safety",
    items: [
      ["How do I block someone?", "Open their profile, tap the menu at the top right, then choose Block. You will stop following each other and their messages are hidden from your inbox."],
      ["How do I control notifications?", "Go to Settings, then Notification preferences. You can turn categories on or off and set quiet hours."],
      ["Someone is bothering me", "Block them first. Then send us a report from Settings with their username and what happened so we can look into it."],
    ],
  },
];

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-4 text-left transition-colors hover:bg-white/5"
      >
        <span className="flex-1 text-[15px] font-semibold text-white">{q}</span>
        <Icon name="chevronRight" className={`size-5 shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <p className="px-4 pb-4 pr-10 text-body leading-[1.45] text-muted">{a}</p>}
    </div>
  );
}

export function HelpView() {
  return (
    <SettingsPage title="Help Center" backHref="/settings">
      {SECTIONS.map((sec) => (
        <div key={sec.title} className="mb-6">
          <SectionLabel>{sec.title}</SectionLabel>
          <Group>
            {sec.items.map(([q, a]) => (
              <Faq key={q} q={q} a={a} />
            ))}
          </Group>
        </div>
      ))}
    </SettingsPage>
  );
}
