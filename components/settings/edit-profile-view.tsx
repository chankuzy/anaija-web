/* eslint-disable @next/next/no-img-element */
"use client";
import { confirmDialog } from "@/lib/ui/dialog";
import { FormSkeleton } from "@/components/ui/skeleton";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { inputClass } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { profileApi, type ProfileUpdate } from "@/lib/api/profile";
import type { UserProfile } from "@/lib/api/users";
import { useAuth } from "@/lib/auth/auth-context";
import { put } from "@/lib/cache/swr";
import { useProfile } from "@/lib/profile/use-profile";
import { ImageCropper, type CropSpec } from "./image-cropper";
import { SectionLabel, SettingsPage, useRequireAuth, useToast } from "./settings-kit";

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
const MAX_LINKS = 5;
type Avail = "unchanged" | "idle" | "checking" | "ok" | "taken" | "invalid" | "unknown";
type Kind = "avatar" | "cover";

const SPECS: Record<Kind, CropSpec> = {
  avatar: { aspect: 1, circle: true, title: "Move and scale", outW: 720, viewW: 300 },
  cover: { aspect: 3, circle: false, title: "Crop cover", outW: 1500, viewW: 480 },
};

const areaCls =
  "w-full resize-none rounded-input bg-surface-interactive px-5 py-4 text-[15px] font-medium leading-[1.4] text-fg outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-brand/60";

// Same key the profile page reads, so the page you return to already shows the new values.
const profileKey = (username: string) => `profile:${username.toLowerCase()}`;

function EditForm({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const { refresh } = useAuth();
  const { toast, show } = useToast();

  const [name, setName] = useState(profile.name ?? "");
  const [username, setUsername] = useState(profile.username);
  const [tagline, setTagline] = useState(profile.tagline ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [links, setLinks] = useState<string[]>(profile.links.length ? profile.links : [""]);
  const [avatar, setAvatar] = useState<string | null>(profile.avatar);
  const [cover, setCover] = useState<string | null>(profile.cover);
  const [avail, setAvail] = useState<Avail>("unchanged");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ kind: Kind; file: File } | null>(null);
  const [uploading, setUploading] = useState<Kind | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const timer = useRef<number | null>(null);
  const latest = useRef(profile.username);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const cleanLinks = links.map((l) => l.trim()).filter(Boolean);
  const dirty =
    name.trim() !== (profile.name ?? "") ||
    username.trim() !== profile.username ||
    tagline.trim() !== (profile.tagline ?? "") ||
    bio.trim() !== (profile.bio ?? "") ||
    location.trim() !== (profile.location ?? "") ||
    cleanLinks.length !== profile.links.length ||
    cleanLinks.some((l, i) => l !== profile.links[i]);
  const usernameOk = avail === "unchanged" || avail === "ok" || avail === "unknown";
  const canSave = dirty && name.trim().length > 0 && usernameOk && !busy && uploading === null;

  function onUsername(raw: string) {
    setUsername(raw);
    setError(null);
    if (timer.current !== null) window.clearTimeout(timer.current);
    const v = raw.trim();
    latest.current = v;
    if (v === profile.username) return setAvail("unchanged");
    if (v.length < 3) return setAvail("idle");
    if (v.length > 30 || !USERNAME_RE.test(v)) return setAvail("invalid");
    setAvail("checking");
    timer.current = window.setTimeout(() => {
      profileApi
        .usernameAvailable(v)
        .then((ok) => {
          if (latest.current === v) setAvail(ok ? "ok" : "taken");
        })
        .catch(() => {
          if (latest.current === v) setAvail("unknown");
        });
    }, 500);
  }

  function pick(kind: Kind, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return show("Please choose an image");
    setCrop({ kind, file: f });
  }

  async function cropped(kind: Kind, blob: Blob) {
    setCrop(null);
    setUploading(kind);
    try {
      if (kind === "avatar") {
        const url = await profileApi.uploadAvatar(blob);
        setAvatar(url);
        put(profileKey(profile.username), { ...profile, avatar: url } as UserProfile);
      } else {
        const url = await profileApi.uploadCover(blob);
        setCover(url);
        put(profileKey(profile.username), { ...profile, cover: url } as UserProfile);
      }
      show(kind === "avatar" ? "Avatar updated" : "Cover updated");
      void refresh();
    } catch (e) {
      show(e instanceof ApiError ? e.message : `Failed to upload ${kind}`);
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    // Only send what changed (links always), so a stale field can never overwrite a real value.
    const body: ProfileUpdate = { name: name.trim(), links: cleanLinks };
    if (username.trim() !== profile.username) body.username = username.trim();
    if (tagline.trim() !== (profile.tagline ?? "")) body.tagline = tagline.trim();
    if (bio.trim() !== (profile.bio ?? "")) body.bio = bio.trim();
    if (location.trim() !== (profile.location ?? "")) body.location = location.trim();
    try {
      await profileApi.update(body);
      // Update the cached profile now, so /me shows the new values the instant you land on it.
      if (username.trim() === profile.username) {
        put(
          profileKey(profile.username),
          {
            ...profile,
            name: name.trim(),
            tagline: tagline.trim() || null,
            bio: bio.trim() || null,
            location: location.trim() || null,
            links: cleanLinks,
          } as UserProfile,
        );
      }
      await refresh();
      router.replace("/me");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setAvail("taken");
        setError("That username is already taken");
      } else setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const hint: Record<Avail, { text: string; cls: string }> = {
    unchanged: { text: "Letters, numbers and underscores", cls: "text-muted" },
    idle: { text: "At least 3 characters", cls: "text-muted" },
    checking: { text: "Checking…", cls: "text-muted" },
    ok: { text: "Available", cls: "text-fg" },
    taken: { text: "Username taken", cls: "text-danger" },
    invalid: { text: "Only letters, numbers and underscores (max 30)", cls: "text-danger" },
    unknown: { text: "Couldn't check right now. We'll verify when you save.", cls: "text-muted" },
  };

  useEffect(() => {
    if (!dirty || busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);

  function back() {
    if (busy) return;
    if (!dirty) {
      router.push("/me");
      return;
    }
    void confirmDialog({ title: "Discard changes?", message: "Your edits to this profile won't be saved.", confirmLabel: "Discard", cancelLabel: "Keep editing", danger: true }).then((ok) => {
      if (ok) router.push("/me");
    });
  }

  const saveBtn = (
    <button
      type="button"
      onClick={() => void save()}
      disabled={!canSave}
      className="h-9 min-w-[76px] rounded-full bg-brand px-5 text-[14px] font-extrabold text-brand-fg transition active:scale-97 disabled:opacity-40"
    >
      {busy ? "Saving…" : "Save"}
    </button>
  );

  return (
    <SettingsPage title="Edit profile" backHref="/me" action={saveBtn} onBack={back}>
      <input ref={avatarInput} type="file" accept="image/*" hidden onChange={(e) => pick("avatar", e)} />
      <input ref={coverInput} type="file" accept="image/*" hidden onChange={(e) => pick("cover", e)} />

      <div className="relative mb-14">
        <div className="relative aspect-[3/1] overflow-hidden rounded-[20px] bg-surface-subtle">
          {cover && <img src={cover} alt="" className="size-full object-cover" />}
          <button
            type="button"
            aria-label="Change cover photo"
            onClick={() => coverInput.current?.click()}
            className="absolute inset-0 grid place-items-center bg-black/25 text-white transition hover:bg-black/35"
          >
            <span className="grid size-12 place-items-center rounded-full bg-black/55">
              {uploading === "cover" ? <span className="text-supporting font-bold">…</span> : <Icon name="camera" filled className="size-6" />}
            </span>
          </button>
        </div>
        <button
          type="button"
          aria-label="Change profile photo"
          onClick={() => avatarInput.current?.click()}
          className="absolute -bottom-10 left-4 rounded-full"
        >
          <span className="block rounded-full border-4 border-bg bg-bg">
            <Avatar url={avatar} name={name || profile.username} size={84} />
          </span>
          <span className="absolute bottom-0.5 right-0 grid size-8 place-items-center rounded-full border-[3px] border-bg bg-brand text-brand-fg">
            {uploading === "avatar" ? <span className="text-micro font-bold">…</span> : <Icon name="camera" filled className="size-4" />}
          </span>
        </button>
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <SectionLabel>Name</SectionLabel>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Full name" />
        </div>

        <div>
          <SectionLabel>Username</SectionLabel>
          <div className="relative">
            <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[15px] text-muted">@</span>
            <input
              className={`${inputClass} pl-10`}
              value={username}
              onChange={(e) => onUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={avail === "taken" || avail === "invalid"}
            />
          </div>
          <p className={`mt-2 px-1 text-supporting ${hint[avail].cls}`}>{hint[avail].text}</p>
        </div>

        <div>
          <SectionLabel>Tagline</SectionLabel>
          <input className={inputClass} value={tagline} maxLength={80} onChange={(e) => setTagline(e.target.value)} placeholder="A short line under your cover" />
          <p className="mt-1 px-1 text-right text-supporting text-muted">{tagline.length}/80</p>
        </div>

        <div>
          <SectionLabel>Bio</SectionLabel>
          <textarea className={`${areaCls} min-h-[112px]`} value={bio} maxLength={160} onChange={(e) => setBio(e.target.value)} placeholder="Tell people about yourself" />
          <p className="mt-1 px-1 text-right text-supporting text-muted">{bio.length}/160</p>
        </div>

        <div>
          <SectionLabel>Location</SectionLabel>
          <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City or campus" />
        </div>

        <div>
          <SectionLabel>Links</SectionLabel>
          <div className="flex flex-col gap-3">
            {links.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className={inputClass}
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  value={l}
                  placeholder="https://"
                  onChange={(e) => setLinks((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <button
                  type="button"
                  aria-label="Remove link"
                  onClick={() => setLinks((p) => (p.length > 1 ? p.filter((_, j) => j !== i) : [""]))}
                  className="grid size-12 shrink-0 place-items-center rounded-full text-white/60 transition hover:bg-white/8 hover:text-white"
                >
                  <Icon name="close" className="size-6" />
                </button>
              </div>
            ))}
          </div>
          {links.length < MAX_LINKS && (
            <button
              type="button"
              onClick={() => setLinks((p) => [...p, ""])}
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-surface-interactive px-4 text-secondary font-bold text-white transition hover:bg-surface-elevated"
            >
              <Icon name="plus" className="size-5" />
              Add link
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="text-body text-danger">
            {error}
          </p>
        )}
      </div>

      {crop && <ImageCropper file={crop.file} spec={SPECS[crop.kind]} onCancel={() => setCrop(null)} onDone={(b) => void cropped(crop.kind, b)} />}
      {toast}
    </SettingsPage>
  );
}

export function EditProfileView() {
  const ready = useRequireAuth();
  const { user } = useAuth();
  const username = user?.username ?? null;

  // Shares the profile page's cache entry: the form opens instantly if you came from your profile.
  const { profile, error, reload } = useProfile(username ?? "", ready && !!username);

  if (profile) return <EditForm key={profile.id} profile={profile} />;
  return (
    <SettingsPage title="Edit profile" backHref="/me">
      {error ? (
        <div className="py-16 text-center">
          <p className="text-[17px] font-bold text-white">Couldn&apos;t load</p>
          <p className="mt-1 text-body text-muted">{error.message}</p>
          <button type="button" onClick={reload} className="mt-5 h-10 rounded-full bg-brand px-5 text-secondary font-extrabold text-brand-fg">
            Try again
          </button>
        </div>
      ) : (
        <FormSkeleton />
      )}
    </SettingsPage>
  );
}
