"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ImageCropper } from "@/components/settings/image-cropper";
import { ApiError } from "@/lib/api/client";
import { mediaUrl } from "@/lib/api/feed";
import { profileApi } from "@/lib/api/profile";
import { useAuth } from "@/lib/auth/auth-context";
import { GHOST } from "./frame";

const SPEC = { aspect: 1, circle: true, title: "Profile photo", outW: 512, viewW: 320 };

// Optional by design. Google accounts arrive with a photo, so the common path is one tap.
export function PhotoStep({ onContinue }: { onContinue: (action: "done" | "skip") => void }) {
  const { user, refresh } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const avatar = user?.avatar ? mediaUrl(user.avatar) : null;

  async function upload(blob: Blob) {
    setFile(null);
    setBusy(true);
    setErr(null);
    try {
      await profileApi.uploadAvatar(blob);
      await refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't upload that photo. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className={`rounded-full p-1.5 ring-2 ${avatar ? "ring-fg/80" : "ring-surface-elevated"} ${busy ? "animate-pulse" : ""}`}>
          <Avatar url={avatar} name={user?.name ?? user?.username} size={136} />
        </div>
        {busy && <p role="status" className="mt-4 text-secondary text-muted">Uploading…</p>}
        {err && <p role="alert" className="mt-4 text-center text-secondary text-danger">{err}</p>}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) setFile(f);
        }}
      />
      <div className="mt-8 flex flex-col gap-1">
        {avatar ? (
          <>
            <Button disabled={busy} onClick={() => onContinue("done")} className="h-14 w-full">Continue</Button>
            <button type="button" disabled={busy} onClick={() => input.current?.click()} className={GHOST}>Change photo</button>
          </>
        ) : (
          <>
            <Button disabled={busy} onClick={() => input.current?.click()} className="h-14 w-full">Upload photo</Button>
            <button type="button" disabled={busy} onClick={() => onContinue("skip")} className={GHOST}>Skip for now</button>
          </>
        )}
      </div>

      {file && <ImageCropper file={file} spec={SPEC} onCancel={() => setFile(null)} onDone={(b) => void upload(b)} />}
    </>
  );
}
