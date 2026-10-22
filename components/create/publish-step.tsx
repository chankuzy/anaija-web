/* eslint-disable @next/next/no-img-element */
"use client";

// Final step for every kind. Port of publish_screen.dart: cover strip, description, hashtag/mention shortcuts,
// a flat settings list, then Save draft and Post.
import { useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import type { Visibility } from "@/lib/create/types";
import type { Composer } from "@/lib/create/use-composer";
import { Dialog, GhostButton, PrimaryButton, SettingsRow, Sheet, Switch } from "./ui";

type Panel = null | "visibility" | "location" | "mention";

const VISIBILITY: { id: Visibility; label: string; icon: IconName }[] = [
  { id: "public", label: "Everyone", icon: "earth" },
  { id: "followers", label: "Followers", icon: "usersGroupRounded" },
  { id: "campus", label: "My Campus", icon: "mapPointSchool" },
];

const inputCls = "h-12 w-full rounded-input border border-line bg-surface px-4 text-[15px] text-fg outline-none placeholder:text-muted";

export function PublishStep({ c, onBack, onDone }: { c: Composer; onBack: () => void; onDone: () => void }) {
  const { draft: d, previews } = c;
  const [panel, setPanel] = useState<Panel>(null);
  const [text, setText] = useState("");
  const ta = useRef<HTMLTextAreaElement>(null);

  const isStory = d.kind === "story";
  const imageCount = d.media.filter((m) => m.type === "image").length;
  const visLabel = VISIBILITY.find((v) => v.id === d.visibility)?.label ?? "Everyone";
  const postLabel = d.kind === "story" ? "Share story" : d.kind === "listing" ? "Post listing" : "Post";

  function insertHashtag() {
    const el = ta.current;
    const s = el?.selectionStart ?? d.caption.length;
    const e = el?.selectionEnd ?? d.caption.length;
    const needsSpace = s > 0 && !/\s/.test(d.caption[s - 1]);
    const ins = `${needsSpace ? " " : ""}#`;
    c.update({ caption: d.caption.slice(0, s) + ins + d.caption.slice(e) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(s + ins.length, s + ins.length);
    });
  }

  function openMention() {
    setText(d.taggedUsernames.join(", "));
    setPanel("mention");
  }
  function saveMention() {
    const names = [...new Set(text.split(",").map((s) => s.trim().replace(/^@/, "")).filter(Boolean))];
    const missing = names.filter((n) => !d.caption.toLowerCase().includes(`@${n.toLowerCase()}`));
    const base = d.caption.trimEnd();
    c.update({
      taggedUsernames: names,
      ...(missing.length ? { caption: `${base ? `${base} ` : ""}${missing.map((n) => `@${n}`).join(" ")}` } : {}),
    });
    setPanel(null);
  }

  function openLocation() {
    setText(d.location ?? "");
    setPanel("location");
  }
  function saveLocation() {
    c.update({ location: text.trim() || null });
    setPanel(null);
  }

  const post = async () => {
    if (await c.publish()) onDone();
  };
  const save = async () => {
    if (await c.saveDraft()) onDone();
  };

  const rows = [
    <SettingsRow key="loc" icon="pinCircle" label="Location" value={d.location} onClick={openLocation} />,
    <SettingsRow
      key="vis"
      icon="earth"
      label={visLabel === "Everyone" ? "Everyone can view this post" : `${visLabel} can view this post`}
      onClick={() => setPanel("visibility")}
    />,
    ...(imageCount > 1
      ? [
          <SettingsRow
            key="slide"
            icon="gallery"
            label="Slideshow"
            trailing={<Switch on={d.slideshow.enabled} label="Slideshow" onChange={(v) => c.update({ slideshow: { ...d.slideshow, enabled: v } })} />}
            onClick={() => c.update({ slideshow: { ...d.slideshow, enabled: !d.slideshow.enabled } })}
          />,
        ]
      : []),
    ...(!isStory
      ? [
          <SettingsRow
            key="comments"
            icon="chatLine"
            label="Allow comments"
            trailing={<Switch on={d.allowComments} label="Allow comments" onChange={(v) => c.update({ allowComments: v })} />}
            onClick={() => c.update({ allowComments: !d.allowComments })}
          />,
        ]
      : []),
    <SettingsRow
      key="also"
      icon="plain"
      label={isStory ? "Also post to your feed" : "Also add to your story"}
      trailing={<Switch on={c.alsoShare} label="Also share" onChange={c.setAlsoShare} />}
      onClick={() => c.setAlsoShare(!c.alsoShare)}
    />,
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center px-1 pb-0 pt-1.5">
        <button type="button" aria-label="Back" disabled={c.busy} onClick={onBack} className="grid size-12 place-items-center text-white disabled:opacity-50">
          <Icon name="back" className="size-5" />
        </button>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        {/* cover strip: the first tile is the cover; tap another to make it the cover */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pt-1">
          {d.media.map((m, i) => (
            <button key={m.id} type="button" onClick={() => i > 0 && c.makeCover(m.id)} className="relative h-[124px] w-[92px] shrink-0 overflow-hidden rounded-xl bg-card">
              {previews[m.id] ? (
                <img src={previews[m.id]!} alt="" draggable={false} className="size-full object-cover" />
              ) : (
                <span className="grid size-full place-items-center text-muted">
                  <Icon name="videocamera" filled className="size-6" />
                </span>
              )}
              {!isStory && (
                <span className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-[7px] py-[3px] text-[10.5px] font-bold text-white">
                  {i === 0 ? "Cover" : i + 1}
                </span>
              )}
            </button>
          ))}
        </div>

        <textarea
          ref={ta}
          rows={4}
          maxLength={500}
          value={d.caption}
          onChange={(e) => c.update({ caption: e.target.value })}
          placeholder="Add a description…"
          className="mt-3.5 block max-h-[190px] min-h-[104px] w-full resize-none bg-transparent px-5 text-[15px] leading-[1.35] text-fg outline-none [field-sizing:content] placeholder:text-muted"
        />

        <div className="mt-3 flex gap-2.5 px-5">
          <button type="button" onClick={insertHashtag} className="inline-flex items-center gap-1.5 rounded-full bg-card px-3.5 py-[9px] text-[13.5px] font-semibold text-fg">
            <Icon name="hashtag" className="size-4" />
            Hashtags
          </button>
          <button type="button" onClick={openMention} className="inline-flex items-center gap-1.5 rounded-full bg-card px-3.5 py-[9px] text-[13.5px] font-semibold text-fg">
            <span className="text-[15px] leading-none">@</span>
            {d.taggedUsernames.length ? `Mention · ${d.taggedUsernames.length}` : "Mention"}
          </button>
        </div>

        <div className="mt-3.5 border-t border-line/60">
          {rows.map((r, i) => (
            <div key={i} className={i > 0 ? "ml-14 border-t border-line/60" : ""}>
              <div className={i > 0 ? "-ml-14" : ""}>{r}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2.5 border-t border-line/60 bg-bg px-4 pb-3 pt-2.5">
        <GhostButton label="Save draft" icon="notebookMinimalistic" disabled={c.busy} onClick={() => void save()} />
        <PrimaryButton label={postLabel} loading={c.busy} onClick={() => void post()} className="flex-1" />
      </div>

      {panel === "visibility" && (
        <Sheet onClose={() => setPanel(null)}>
          <div className="pb-2 pt-3">
            {VISIBILITY.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  c.update({ visibility: v.id });
                  setPanel(null);
                }}
                className="flex w-full items-center gap-3.5 px-6 py-3.5 text-left hover:bg-white/4"
              >
                <Icon name={v.icon} filled className="size-6 text-white" />
                <span className="flex-1 text-[15.5px] text-fg">{v.label}</span>
                {d.visibility === v.id && <Icon name="check" className="size-5 text-white" />}
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {panel === "location" && (
        <Dialog title="Add location" onClose={() => setPanel(null)} onSave={saveLocation}>
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveLocation()} placeholder="e.g. AFIT, Kaduna" className={inputCls} />
        </Dialog>
      )}
      {panel === "mention" && (
        <Dialog title="Mention people" onClose={() => setPanel(null)} onSave={saveMention}>
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveMention()} placeholder="usernames, comma separated" className={inputCls} />
        </Dialog>
      )}
    </div>
  );
}
