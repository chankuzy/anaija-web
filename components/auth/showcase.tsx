import { Icon, type IconName } from "@/components/ui/icon";

const LIME = "#C8FA00";
const G = [
  `linear-gradient(135deg,#1f2a0a,${LIME} 140%)`,
  "linear-gradient(160deg,#0f2027,#2c5364)",
  "linear-gradient(135deg,#3a1c71,#d76d77)",
  "linear-gradient(160deg,#232526,#414345)",
  "linear-gradient(135deg,#134e5e,#71b280)",
  "linear-gradient(160deg,#42275a,#734b6d)",
  "linear-gradient(135deg,#ff9a44,#4a1d0a)",
  "linear-gradient(160deg,#16222a,#3a6073)",
  `linear-gradient(135deg,#0b3d2e,${LIME} 180%)`,
];

const NAV: { icon: IconName; label: string }[] = [
  { icon: "home", label: "Home" },
  { icon: "search", label: "Discover" },
  { icon: "plus", label: "" },
  { icon: "message", label: "Messages" },
  { icon: "user", label: "Profile" },
];

function Heart({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-9.6-9.2C1 8.6 2.8 5 6.2 5c2 0 3.3 1.1 3.8 2 .5-.9 1.8-2 3.8-2 3.4 0 5.2 3.6 3.8 6.8C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

function PhoneNav({ active }: { active: number }) {
  return (
    <div className="flex items-center justify-between bg-black/85 px-3 pb-2.5 pt-2">
      {NAV.map((n, i) =>
        n.icon === "plus" ? (
          <span key={i} className="grid h-[22px] w-[34px] place-items-center rounded-[8px] bg-white text-black">
            <Icon name="plus" className="size-3.5" />
          </span>
        ) : (
          <span key={i} className={`flex flex-col items-center gap-[2px] ${i === active ? "text-white" : "text-white/45"}`}>
            <Icon name={n.icon} className="size-[15px]" />
            <span className="text-[7px] font-semibold">{n.label}</span>
          </span>
        ),
      )}
    </div>
  );
}

function Rail({ likes }: { likes: string }) {
  return (
    <div className="absolute bottom-3 right-2 flex flex-col items-center gap-2.5 text-white">
      <Heart className="size-[18px] text-[#ff5c5c]" />
      <span className="-mt-2 text-[8px] font-bold">{likes}</span>
      <Icon name="chatLine" filled className="size-[18px]" />
      <Icon name="plain" filled className="size-[18px]" />
    </div>
  );
}

function FeedScreen() {
  return (
    <>
      <div className="relative flex-1" style={{ background: G[8] }}>
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-7 text-white">
          <span className="text-[10px] font-bold">For You</span>
          <Icon name="bell" className="size-3.5" />
        </div>
        <div className="absolute left-3 right-12 bottom-[52px] inline-flex w-fit items-center gap-1.5 rounded-[10px] border border-white/20 bg-black/45 px-2 py-1.5">
          <span className="text-[11px] font-extrabold text-white">₦40,000</span>
          <span className="rounded-md bg-[#ffb340]/25 px-1 text-[8px] font-bold text-[#ffb340]">Nego</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2.5 pt-8">
          <div className="flex items-center gap-1.5">
            <span className="size-5 rounded-full" style={{ background: G[0] }} />
            <span className="text-[10px] font-bold text-white">campus.thrift</span>
          </div>
          <p className="mt-1 text-[9px] text-white/80">Clean sneakers, size 43</p>
        </div>
        <Rail likes="128" />
      </div>
      <PhoneNav active={0} />
    </>
  );
}

function ProfileScreen() {
  const prices: Record<number, string> = { 1: "₦5,000", 4: "₦50,000", 7: "₦2,000" };
  return (
    <>
      <div className="flex-1 overflow-hidden bg-black">
        <div className="flex items-center gap-2 px-3 pb-2 pt-8">
          <span className="size-8 rounded-full" style={{ background: G[0] }} />
          <div className="space-y-1">
            <span className="block h-1.5 w-16 rounded bg-white/70" />
            <span className="block h-1 w-10 rounded bg-white/30" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-[2px]">
          {G.slice(0, 9).map((g, i) => (
            <div key={i} className="relative aspect-[3/4]" style={{ background: g }}>
              {prices[i] && (
                <span className="absolute inset-x-1 bottom-1 rounded-full bg-black/60 py-[2px] text-center text-[7px] font-bold text-white">{prices[i]}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      <PhoneNav active={4} />
    </>
  );
}

function ReelScreen() {
  return (
    <>
      <div className="relative flex-1" style={{ background: G[2] }}>
        <div className="absolute inset-x-3 top-7 flex gap-1">
          <span className="h-[2px] flex-1 rounded bg-white" />
          <span className="h-[2px] flex-1 rounded bg-white/35" />
          <span className="h-[2px] flex-1 rounded bg-white/35" />
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2.5 pt-8">
          <div className="flex items-center gap-1.5">
            <span className="size-5 rounded-full" style={{ background: G[4] }} />
            <span className="text-[10px] font-bold text-white">weekend.vibes</span>
          </div>
          <p className="mt-1 text-[9px] text-white/80">Weekend on campus</p>
        </div>
        <Rail likes="2.4k" />
      </div>
      <PhoneNav active={0} />
    </>
  );
}

function Phone({ className, delay, children }: { className: string; delay: number; children: React.ReactNode }) {
  return (
    <div className={`login-rise absolute ${className}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="login-float" style={{ animationDelay: `${delay * 3}ms` }}>
        <div className="relative flex h-[440px] w-[216px] flex-col overflow-hidden rounded-[34px] border border-white/12 bg-black shadow-[0_30px_60px_rgba(0,0,0,0.6)]">
          <span className="absolute left-1/2 top-2 z-10 h-[10px] w-[54px] -translate-x-1/2 rounded-full bg-black" />
          {children}
        </div>
      </div>
    </div>
  );
}

/** Three fanned phones. Decorative only; the container is aria-hidden. */
export function Showcase() {
  return (
    <div aria-hidden className="relative mx-auto h-[330px] w-full md:h-[520px] md:w-[520px]">
      <div className="absolute left-1/2 top-0 h-[520px] w-[520px] origin-top -translate-x-1/2 scale-[0.62] md:scale-100">
        <div
          className="login-glow absolute left-1/2 top-1/2 size-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(200,250,0,0.22), transparent)" }}
        />
        <Phone className="left-0 top-[70px] -rotate-[9deg] scale-[0.92]" delay={250}>
          <ProfileScreen />
        </Phone>
        <Phone className="right-0 top-[70px] rotate-[9deg] scale-[0.92]" delay={400}>
          <ReelScreen />
        </Phone>
        <Phone className="left-[152px] top-0 z-10" delay={0}>
          <FeedScreen />
        </Phone>
      </div>
    </div>
  );
}
