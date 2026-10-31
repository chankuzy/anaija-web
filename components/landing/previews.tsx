// Decorative product previews, built from the same tokens as the app. They illustrate how Communities work;
// they contain no names, counts or activity. Every consumer wraps them in aria-hidden and describes them in text.
import { Icon, type IconName } from "@/components/ui/icon";

const PANEL = "relative overflow-hidden rounded-[22px] bg-[#111114] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]";

function IconTile({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <span className={`grid size-9 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand ${className}`}>
      <Icon name={name} filled className="size-[18px]" />
    </span>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span className={`relative h-5 w-9 shrink-0 rounded-full ${on ? "bg-brand" : "bg-white/15"}`}>
      <span className={`absolute top-0.5 size-4 rounded-full ${on ? "right-0.5 bg-[#17130a]" : "left-0.5 bg-white"}`} />
    </span>
  );
}

export function LibraryMock() {
  const rows: [string, string, IconName][] = [
    ["Past questions", "Exam papers · PDF", "notebookMinimalistic"],
    ["Lecture notes", "Organised by course · PDF", "book"],
    ["Slides", "From the lecturer · PDF", "gallery"],
  ];
  return (
    <div className={`${PANEL} h-full p-3.5`}>
      <div className="flex items-center gap-2 text-[13px] font-bold">
        <Icon name="book" filled className="size-4 text-brand" /> Library
      </div>
      <div className="mt-3 flex gap-1.5 text-[11px] font-semibold">
        <span className="rounded-full bg-brand px-2.5 py-1 text-brand-fg">All</span>
        <span className="rounded-full bg-white/8 px-2.5 py-1 text-white/70">Past questions</span>
        <span className="rounded-full bg-white/8 px-2.5 py-1 text-white/70">Notes</span>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map(([t, m, icon]) => (
          <div key={t} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-2.5">
            <IconTile name={icon} />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{t}</p>
              <p className="truncate text-[11px] text-white/50">{m}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PdfMock() {
  const lines = ["w-full", "w-[92%]", "w-[96%]", "w-[70%]"];
  return (
    <div className={`${PANEL} h-full`}>
      <div className="flex items-center justify-between px-3.5 py-3 text-[11px] font-semibold text-white/65">
        <span className="flex items-center gap-1">
          <Icon name="altArrowLeft" className="size-4" /> Lecture notes
        </span>
        <span>Page 3</span>
      </div>
      <div className="mx-3.5 rounded-t-xl bg-[#f4f4f6] p-4 text-[#17130a]">
        <div className="h-2.5 w-1/2 rounded bg-black/80" />
        <div className="mt-4 space-y-2">
          {lines.map((w, i) => (
            <div key={i} className={`h-1.5 rounded bg-black/20 ${w}`} />
          ))}
          <div className="h-1.5 w-[88%] rounded bg-[#ffd84d]" />
          {lines.map((w, i) => (
            <div key={`b${i}`} className={`h-1.5 rounded bg-black/20 ${w}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AnnouncementMock() {
  return (
    <div className={`${PANEL} h-full p-3.5`}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-brand">
        <Icon name="pin" filled className="size-4" /> Pinned announcement
      </div>
      <p className="mt-2.5 text-[16px] font-bold leading-snug">Tutorial moved to Friday</p>
      <p className="mt-1 text-[12px] leading-relaxed text-white/55">Same venue, same time. Bring your notes.</p>
      <div className="mt-5 space-y-2 opacity-35">
        <div className="h-7 w-3/5 rounded-2xl rounded-bl-md bg-white/15" />
        <div className="ml-auto h-7 w-1/2 rounded-2xl rounded-br-md bg-white/15" />
        <div className="h-7 w-2/3 rounded-2xl rounded-bl-md bg-white/15" />
      </div>
    </div>
  );
}

export function AnonymousMock() {
  return (
    <div className={`${PANEL} h-full p-3.5`}>
      <div className="flex items-center gap-2 text-[12px] font-bold">
        <span className="grid size-7 place-items-center rounded-full bg-white/10">
          <Icon name="eyeClosed" className="size-4" />
        </span>
        Anonymous
      </div>
      <div className="mt-3 max-w-[88%] rounded-2xl rounded-tl-md bg-white/[0.07] px-3 py-2.5 text-[13px] leading-snug">
        Is anyone else lost on question 3?
      </div>
      <div className="mt-2 ml-auto max-w-[80%] rounded-2xl rounded-tr-md bg-white/[0.07] px-3 py-2.5 text-[13px] leading-snug">
        Same. It was explained differently in week 2.
      </div>
      <div className="mt-3 flex h-10 items-center rounded-full bg-white/[0.06] px-4 text-[12px] text-white/40">Say it anonymously…</div>
    </div>
  );
}

export function SessionMock() {
  return (
    <div className={`${PANEL} h-full p-3.5`}>
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-bold">Revision night</p>
        <span className="flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-bold">
          <span className="lp-live size-1.5 rounded-full bg-[#ff3b5c]" /> Live
        </span>
      </div>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">Who can join</p>
      <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-full bg-white/[0.06] p-1 text-center text-[11px] font-bold">
        <span className="rounded-full bg-brand py-1.5 text-brand-fg">Open</span>
        <span className="py-1.5 text-white/60">Request</span>
        <span className="py-1.5 text-white/60">Invite</span>
      </div>
      <div className="mt-3 space-y-2.5 text-[13px]">
        <div className="flex items-center justify-between">
          Replies <Toggle on />
        </div>
        <div className="flex items-center justify-between">
          Reactions <Toggle on />
        </div>
      </div>
    </div>
  );
}

export function ChatMock() {
  return (
    <div className={`${PANEL} h-full p-3.5`}>
      <div className="flex gap-4 text-[12px] font-semibold text-white/45">
        <span>Feed</span>
        <span className="relative text-white">
          Chat<span className="absolute -bottom-1.5 left-0 h-0.5 w-full rounded bg-brand" />
        </span>
        <span>Library</span>
        <span>About</span>
      </div>
      <div className="mt-5 flex items-end gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10">
          <Icon name="user" filled className="size-4 text-white/60" />
        </span>
        <div className="max-w-[78%] rounded-[18px] rounded-bl-md bg-white/[0.08] px-3 py-2 text-[13px]">Did anyone save the slides?</div>
      </div>
      <div className="mt-2 flex justify-end">
        <div className="bubble-sent max-w-[78%] rounded-[18px] rounded-br-md px-3 py-2 text-[13px] font-medium">It&apos;s in the Library. Week 4.</div>
      </div>
      <div className="mt-2 flex items-center gap-1 pl-9">
        <span className="size-1.5 rounded-full bg-white/40" />
        <span className="size-1.5 rounded-full bg-white/30" />
        <span className="size-1.5 rounded-full bg-white/20" />
      </div>
    </div>
  );
}
