import type { ReactNode } from "react";

// Skeleton kit. Every block uses the shared `.sk-block` shimmer (globals.css), and every region is announced
// to screen readers once (role="status" + aria-busy) while the blocks themselves stay hidden from them.
export function Sk({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`sk-block block ${className}`} />;
}

function Region({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      {children}
    </div>
  );
}

const LINE_A = ["w-32", "w-40", "w-28", "w-36", "w-44", "w-24"];
const LINE_B = ["w-20", "w-28", "w-16", "w-24", "w-32", "w-14"];

/** Thin bar under a list while the next page loads. */
export function MoreSkeleton() {
  return (
    <Region label="Loading more" className="grid h-14 place-items-center">
      <Sk className="h-1.5 w-20 rounded-full" />
    </Region>
  );
}

/** People / list rows: followers, following, blocked accounts, inquiries, institutions (avatar={false}). */
export function UserRowsSkeleton({ count = 8, avatar = true }: { count?: number; avatar?: boolean }) {
  return (
    <Region label="Loading" className="py-1">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
          {avatar && <Sk className="size-[46px] shrink-0 rounded-full" />}
          <div className="flex-1 space-y-2">
            <Sk className={`h-3.5 ${LINE_A[i % LINE_A.length]} rounded-full`} />
            <Sk className={`h-3 ${LINE_B[i % LINE_B.length]} rounded-full`} />
          </div>
          {avatar && <Sk className="h-8 w-[76px] shrink-0 rounded-full" />}
        </div>
      ))}
    </Region>
  );
}

/** Activity / notification rows: avatar with kind badge, two lines, optional thumbnail. */
export function ActivitySkeleton({ count = 8 }: { count?: number }) {
  return (
    <Region label="Loading activity" className="py-1">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <span className="relative shrink-0">
            <Sk className="size-[46px] rounded-full" />
            <Sk className="absolute -bottom-1 -right-1 size-[20px] rounded-full ring-2 ring-bg" />
          </span>
          <div className="flex-1 space-y-2">
            <Sk className="h-3.5 w-[82%] rounded-full" />
            <Sk className={`h-3 ${i % 2 ? "w-[46%]" : "w-[62%]"} rounded-full`} />
          </div>
          {i % 3 !== 1 && <Sk className="size-[46px] shrink-0 rounded-xl" />}
        </div>
      ))}
    </Region>
  );
}

/** Comment rows in the sheet. */
export function CommentsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <Region label="Loading comments" className="py-1">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex gap-3 px-4 py-3">
          <Sk className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2 pt-0.5">
            <Sk className="h-3 w-24 rounded-full" />
            <Sk className={`h-3.5 ${i % 2 ? "w-[58%]" : "w-[86%]"} rounded-full`} />
            {i % 3 === 0 && <Sk className="h-3.5 w-[40%] rounded-full" />}
          </div>
        </div>
      ))}
    </Region>
  );
}

/** Message bubbles for a conversation that is still loading. */
export function ChatSkeleton() {
  const rows: [boolean, string, string][] = [
    [false, "w-[52%]", "h-10"],
    [false, "w-[38%]", "h-10"],
    [true, "w-[60%]", "h-10"],
    [false, "w-[70%]", "h-16"],
    [true, "w-[34%]", "h-10"],
    [true, "w-[48%]", "h-10"],
  ];
  return (
    <Region label="Loading messages" className="flex w-full flex-col gap-2">
      {rows.map(([mine, w, h], i) => (
        <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
          <Sk className={`${w} ${h} rounded-[20px]`} />
        </div>
      ))}
    </Region>
  );
}

/** Edit-profile style form: avatar, then labelled fields. */
export function FormSkeleton() {
  return (
    <Region label="Loading" className="space-y-6 pt-2">
      <div className="flex flex-col items-center gap-3">
        <Sk className="size-24 rounded-full" />
        <Sk className="h-3 w-24 rounded-full" />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <Sk className="h-3 w-20 rounded-full" />
          <Sk className={`${i === 3 ? "h-24" : "h-12"} w-full rounded-[18px]`} />
        </div>
      ))}
    </Region>
  );
}

/** Settings pages: a section label and a rounded group of icon + label + control rows. */
export function SettingsGroupsSkeleton({ groups = 2, rows = 3 }: { groups?: number; rows?: number }) {
  return (
    <Region label="Loading settings" className="space-y-5">
      {Array.from({ length: groups }, (_, g) => (
        <div key={g}>
          <Sk className="mb-3 ml-1.5 h-2.5 w-24 rounded-full" />
          <div className="overflow-hidden rounded-[20px] bg-white/5">
            {Array.from({ length: rows }, (_, r) => (
              <div key={r} className="flex items-center gap-3.5 px-4 py-4">
                <Sk className="size-6 shrink-0 rounded-md" />
                <Sk className={`h-4 ${LINE_A[(g + r) % LINE_A.length]} rounded-full`} />
                <span className="flex-1" />
                <Sk className="h-7 w-12 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </Region>
  );
}

/** Listing page: media, price, title, details, seller. */
export function ListingSkeleton({ back }: { back?: ReactNode }) {
  return (
    <Region label="Loading listing" className="mx-auto w-full max-w-[960px] px-4 pb-10 pt-3 md:pt-8">
      {back}
      <div className="mt-3 grid gap-6 md:grid-cols-2">
        <Sk className="aspect-[4/5] w-full rounded-[22px]" />
        <div className="space-y-5">
          <Sk className="h-8 w-40 rounded-xl" />
          <Sk className="h-5 w-[80%] rounded-full" />
          <div className="space-y-2.5">
            <Sk className="h-3.5 w-full rounded-full" />
            <Sk className="h-3.5 w-[92%] rounded-full" />
            <Sk className="h-3.5 w-[60%] rounded-full" />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Sk className="size-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Sk className="h-3.5 w-32 rounded-full" />
              <Sk className="h-3 w-20 rounded-full" />
            </div>
          </div>
          <Sk className="h-12 w-full rounded-full" />
        </div>
      </div>
    </Region>
  );
}

/** Create flow while auth resolves or the route suspends: header, media area, caption, action bar. */
export function CreateSkeleton() {
  return (
    <Region label="Loading composer" className="mx-auto w-full max-w-[640px] px-4 pb-4 pt-3 md:pt-8">
      <div className="flex items-center gap-3 py-1.5">
        <Sk className="size-10 rounded-full" />
        <Sk className="h-5 w-28 rounded-full" />
        <span className="flex-1" />
        <Sk className="h-9 w-24 rounded-full" />
      </div>
      <div className="mt-3 flex gap-2">
        {[0, 1, 2].map((i) => (
          <Sk key={i} className="h-9 w-20 rounded-full" />
        ))}
      </div>
      <Sk className="mt-4 aspect-[4/5] w-full rounded-[22px]" />
      <div className="mt-5 space-y-2.5">
        <Sk className="h-3.5 w-full rounded-full" />
        <Sk className="h-3.5 w-[70%] rounded-full" />
      </div>
      <Sk className="mt-8 h-[50px] w-full rounded-full" />
    </Region>
  );
}
