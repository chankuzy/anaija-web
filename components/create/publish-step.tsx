/* eslint-disable @next/next/no-img-element */
"use client";

// Final step for every kind. Port of publish_screen.dart: cover strip, description with inline @mentions,
// a flat settings list (listing details expand in place for listings), then Save draft and Post.
import { useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { listingError, listingSummary } from "@/lib/create/listing";
import { mentionsOf } from "@/lib/create/mentions";
import type { Visibility } from "@/lib/create/types";
import type { Composer } from "@/lib/create/use-composer";
import { ListingDetails } from "./listing-details";
import { MentionTextarea, type MentionHandle } from "./mention-textarea";
import { GhostButton, PrimaryButton, SettingsRow, Sheet, Switch } from "./ui";

const VISIBILITY: { id: Visibility; label: string; icon: IconName }[] = [
  { id: "public", label: "Everyone", icon: "earth" },
  { id: "followers", label: "Followers", icon: "usersGroupRounded" },
  { id: "campus", label: "My Campus", icon: "mapPointSchool" },
];

export function PublishStep({ c, onBack, onDone }: { c: Composer; onBack: () => void; onDone: () => void }) {
  const { draft: d, previews } = c;
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const caption = useRef<MentionHandle>(null);

  const isStory = d.kind === "story";
  const isListing = d.kind === "listing";
  const imageCount = d.media.filter((m) => m.type === "image").length;
  const visLabel = VISIBILITY.find((v) => v.id === d.visibility)?.label ?? "Everyone";
  const postLabel = d.kind === "story" ? "Share story" : d.kind === "listing" ? "Post listing" : "Post";

  // Tagged users always mirror the caption, so deleting "@name" from the text un-tags it.
  const setCaption = (next: string) => c.update({ caption: next, taggedUsernames: mentionsOf(next) });

  const post = async () => {
    const err = listingError(d);
    if (err) {
      setDetailsOpen(true);
      c.flash("err", err);
      return;
    }
    if (await c.publish()) onDone();
  };
  const save = async () => {
    if (await c.saveDraft()) onDone();
  };

  const rows = [
    ...(!isListing && !c.inCommunity
      ? [
          <SettingsRow
            key="vis"
            icon="earth"
            label={visLabel === "Everyone" ? "Everyone can view this post" : `${visLabel} can view this post`}
            onClick={() => setVisibilityOpen(true)}
          />,
        ]
      : []),
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
    ...(c.inCommunity
      ? []
      : [
          <SettingsRow
            key="also"
            icon="plain"
            label={isStory ? "Also post to your feed" : "Also add to your story"}
            trailing={<Switch on={c.alsoShare} label="Also share" onChange={c.setAlsoShare} />}
            onClick={() => c.setAlsoShare(!c.alsoShare)}
          />,
        ]),
    ...(isListing
      ? [
          <div key="listing">
            <SettingsRow
              icon="notebookMinimalistic"
              label="Listing details"
              value={detailsOpen ? null : listingSummary(d)}
              trailing={<Icon name="chevronDown" className={`size-[22px] shrink-0 text-muted transition-transform duration-200 ${detailsOpen ? "rotate-180" : ""}`} />}
              onClick={() => setDetailsOpen((o) => !o)}
            />
            {detailsOpen && <ListingDetails c={c} />}
          </div>,
        ]
      : []),
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

        <MentionTextarea
          ref={caption}
          value={d.caption}
          onChange={setCaption}
          placeholder={isListing ? "Describe what you're selling…" : "Add a description…"}
        />

        <div className="mt-3 flex gap-2.5 px-5">
          <button type="button" onClick={() => caption.current?.insertAtCaret("#")} className="inline-flex items-center gap-1.5 rounded-full bg-card px-3.5 py-[9px] text-[13.5px] font-semibold text-fg">
            <Icon name="hashtag" className="size-4" />
            Hashtags
          </button>
          <button type="button" onClick={() => caption.current?.insertAtCaret("@")} className="inline-flex items-center gap-1.5 rounded-full bg-card px-3.5 py-[9px] text-[13.5px] font-semibold text-fg">
            <span className="text-[15px] leading-none">@</span>
            {d.taggedUsernames.length ? `Mention · ${d.taggedUsernames.length}` : "Mention"}
          </button>
        </div>

        <div className="mt-3.5">
          {rows.map((r, i) => (
            <div key={i} className={i > 0 ? "ml-14" : ""}>
              <div className={i > 0 ? "-ml-14" : ""}>{r}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2.5 bg-bg px-4 pb-3 pt-2.5">
        <GhostButton label="Save draft" icon="notebookMinimalistic" disabled={c.busy} onClick={() => void save()} />
        <PrimaryButton label={postLabel} loading={c.busy} onClick={() => void post()} className="flex-1" />
      </div>

      {visibilityOpen && (
        <Sheet onClose={() => setVisibilityOpen(false)}>
          <div className="pb-2 pt-3">
            {VISIBILITY.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  c.update({ visibility: v.id });
                  setVisibilityOpen(false);
                }}
                className="flex w-full items-center gap-3.5 px-6 py-3.5 text-left hover:bg-white/4"
              >
                <Icon name={v.icon} filled className="size-6 text-white" />
                <span className="flex-1 text-[15.5px] text-fg">{v.label}</span>
                {d.visibility === v.id && <Icon name="check" className="size-5 text-brand" />}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}
