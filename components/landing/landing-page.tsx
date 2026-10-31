/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import Link from "next/link";
import { Suspense } from "react";
import { AppLogo } from "@/components/ui/app-logo";
import { Icon, type IconName } from "@/components/ui/icon";
import { buttonClass } from "@/components/ui/button";
import { getLandingData } from "@/lib/server/landing";
import { abs } from "@/lib/share/meta";
import { display } from "./fonts";
import { CommunityCard, Tile } from "./discovery";
import { AnnouncementMock, AnonymousMock, ChatMock, LibraryMock, PdfMock, SessionMock } from "./previews";
import "./landing.css";

const JOIN = "/login";
const CLASS_REP = "/login?next=%2Fcommunities%2Fnew";
const WRAP = "mx-auto w-full max-w-6xl px-5";

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-brand">{children}</p>;
}
const H2 = `${display.className} lp-display text-[clamp(2rem,6.4vw,3.4rem)] leading-[1.06] tracking-[-0.02em]`;

/* ───────────── Nav ───────────── */
function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-bg/80 backdrop-blur-xl" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className={`${WRAP} flex h-14 items-center justify-between`}>
        <Link href="/" aria-label="Anaija home" className="flex items-center">
          <AppLogo size={30} />
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-7 text-[14px] font-semibold text-white/65 md:flex">
          <a href="#discover" className="transition-colors hover:text-white">Discover</a>
          <a href="#communities" className="transition-colors hover:text-white">Communities</a>
          <a href="#hustle" className="transition-colors hover:text-white">Hustle. Flex. Earn.</a>
        </nav>
        <div className="flex items-center gap-1.5">
          <Link href="/login" className="relative hit-area px-3 py-2 text-[14px] font-semibold text-white/75 transition-colors hover:text-white">
            Sign in
          </Link>
          <Link href={JOIN} className={`${buttonClass("primary", "h-9! px-4! text-[13px]!")} relative hit-area`}>
            Join
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ───────────── Hero ───────────── */
function HeroChip({ className, delay, children }: { className: string; delay: number; children: ReactNode }) {
  return (
    <div className={`lp-rise absolute ${className}`} style={{ ["--d" as string]: `${delay}ms` }}>
      <div
        className="lp-float w-[170px] rounded-2xl bg-[rgba(22,22,26,0.82)] p-3 shadow-[0_18px_40px_rgba(0,0,0,0.5),inset_0_0_0_1px_rgba(255,255,255,0.09)] backdrop-blur-xl md:w-[196px]"
        style={{ ["--d" as string]: `${delay * 2}ms` }}
      >
        {children}
      </div>
    </div>
  );
}

function HeroStage() {
  return (
    <div aria-hidden className="relative mx-auto h-[410px] w-full max-w-[400px] md:h-[560px] md:max-w-[470px]">
      <div className="absolute left-1/2 top-0 h-[380px] w-[186px] -translate-x-1/2 overflow-hidden rounded-[34px] bg-black shadow-[0_34px_80px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.1)] md:h-[520px] md:w-[256px] md:rounded-[40px]">
        <span className="absolute left-1/2 top-2 z-10 h-[10px] w-[54px] -translate-x-1/2 rounded-full bg-black" />
        <img src="/brand/auth/feed.jpg" alt="" width={256} height={520} fetchPriority="high" decoding="async" className="size-full object-cover object-top" />
      </div>

      <HeroChip className="left-0 top-[64px] md:top-[84px]" delay={200}>
        <div className="flex items-center gap-2 text-[11px] font-bold text-brand">
          <Icon name="book" filled className="size-4" /> Library
        </div>
        <p className="mt-1.5 text-[13px] font-semibold leading-tight">Past questions</p>
        <p className="text-[11px] text-white/50">Open it right here · PDF</p>
      </HeroChip>

      <HeroChip className="right-0 top-[176px] md:top-[236px]" delay={380}>
        <div className="flex items-center gap-2 text-[11px] font-bold text-brand">
          <Icon name="pin" filled className="size-4" /> Pinned
        </div>
        <p className="mt-1.5 text-[13px] font-semibold leading-tight">Tutorial moved to Friday</p>
        <p className="text-[11px] text-white/50">Stays above the chat</p>
      </HeroChip>

      <HeroChip className="bottom-0 left-[4%] md:bottom-6" delay={560}>
        <div className="flex items-center gap-2 text-[11px] font-bold text-white/70">
          <Icon name="eyeClosed" className="size-4" /> Anonymous
        </div>
        <p className="mt-1.5 text-[13px] font-semibold leading-tight">Is anyone else lost on question 3?</p>
      </HeroChip>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-x-clip pb-14 pt-9 md:pb-24 md:pt-16">
      <div aria-hidden className="lp-glow" />
      <div className={`${WRAP} relative grid items-center gap-9 md:grid-cols-[1.05fr_0.95fr]`}>
        <div>
          <Eyebrow>The social home for campus life</Eyebrow>
          <h1 className={`${display.className} lp-display mt-4 text-[clamp(2.7rem,10.5vw,5.1rem)] leading-[1.02] tracking-[-0.028em]`}>
            Your campus. <span className="text-brand">A whole world inside.</span>
          </h1>
          <p className="mt-5 max-w-[30ch] text-[18px] leading-snug text-white/70 md:text-[20px]">Be seen. Find your people. Make something happen.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#discover" className={buttonClass("primary", "w-full sm:w-auto sm:px-8")}>
              Explore Anaija <Icon name="arrowDown" className="size-4" />
            </a>
            <Link href={JOIN} className={buttonClass("outline", "w-full sm:w-auto sm:px-8")}>
              Join Anaija
            </Link>
          </div>
          <p className="mt-4 text-[13px] text-white/45">One tap with Google. No password to remember.</p>
        </div>
        <HeroStage />
      </div>
    </section>
  );
}

/* ───────────── Public discovery (real data) ───────────── */
function RailSkeleton() {
  return (
    <div className="lp-rail" style={{ ["--cols" as string]: 4 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="sk-block aspect-[4/5] w-[56vw] max-w-[240px] rounded-[22px] md:w-auto md:max-w-none" />
      ))}
    </div>
  );
}

async function DiscoveryBody() {
  const { communities, tiles } = await getLandingData();
  const posts = tiles.filter((t) => t.kind !== "listing").slice(0, 8);
  if (communities.length === 0 && posts.length === 0) {
    return (
      <div className="rounded-[26px] bg-white/[0.03] p-6 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
        <p className="text-[15px] text-white/65">Nothing to preview right now. You can still look around.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Link href="/watch" className={buttonClass("outline", "w-full sm:w-auto")}>Watch reels</Link>
          <Link href={JOIN} className={buttonClass("primary", "w-full sm:w-auto")}>Join Anaija</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-9">
      {communities.length > 0 && (
        <div>
          <h3 className="mb-3 text-[13px] font-bold uppercase tracking-[0.14em] text-white/45">Communities you can open</h3>
          <div className="lp-rail" style={{ ["--cols" as string]: 3 }}>
            {communities.map((c) => (
              <CommunityCard key={c.slug} c={c} />
            ))}
          </div>
        </div>
      )}
      {posts.length > 0 && (
        <div>
          <h3 className="mb-3 text-[13px] font-bold uppercase tracking-[0.14em] text-white/45">From around Anaija</h3>
          <div className="lp-rail" style={{ ["--cols" as string]: 4 }}>
            {posts.map((t) => (
              <Tile key={t.id} t={t} />
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/watch" className={buttonClass("outline", "w-full sm:w-auto")}>Watch reels</Link>
        <Link href={JOIN} className={buttonClass("primary", "w-full sm:w-auto")}>Join to see your campus</Link>
      </div>
    </div>
  );
}

function Discover() {
  return (
    <section id="discover" className="py-14 md:py-20">
      <div className={WRAP}>
        <div className="lp-reveal mb-8 max-w-2xl">
          <Eyebrow>Public right now</Eyebrow>
          <h2 className={`${H2} mt-3`}>See what&apos;s happening.</h2>
          <p className="mt-3 text-[16px] leading-relaxed text-white/60">Real posts and communities, straight from Anaija. Tap anything to look closer.</p>
        </div>
        <Suspense fallback={<RailSkeleton />}>
          <DiscoveryBody />
        </Suspense>
      </div>
    </section>
  );
}

/* ───────────── Communities ───────────── */
function Scene({ cls, title, text, children }: { cls: string; title: string; text: string; children: ReactNode }) {
  return (
    <article className={`lp-reveal flex w-[80vw] max-w-[340px] flex-col rounded-[26px] bg-white/[0.03] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] md:w-auto md:max-w-none ${cls}`}>
      <div aria-hidden className="h-[236px] overflow-hidden rounded-[20px]">
        {children}
      </div>
      <div className="px-2 pb-2 pt-4">
        <h3 className="text-[17px] font-bold">{title}</h3>
        <p className="mt-1 text-[14px] leading-relaxed text-white/60">{text}</p>
      </div>
    </article>
  );
}

function Communities() {
  return (
    <section id="communities" className="bg-white/[0.02] py-14 md:py-24">
      <div className={WRAP}>
        <div className="lp-reveal max-w-2xl">
          <Eyebrow>Communities</Eyebrow>
          <h2 className={`${H2} mt-3`}>Your class deserves more than a group chat.</h2>
          <p className="mt-4 text-[16px] leading-relaxed text-white/60">
            One organised place for lecture materials, past questions, announcements, academic discussions and your people.
          </p>
        </div>

        <div className="lp-rail mt-9 md:grid-cols-6" style={{ ["--cols" as string]: 6 }}>
          <Scene cls="md:col-span-3" title="A library that stays organised" text="Notes, past questions and slides sorted by course, so nothing scrolls away.">
            <LibraryMock />
          </Scene>
          <Scene cls="md:col-span-3" title="Read without leaving" text="Open documents in a clean in-app reader. No downloads, no hunting for the file.">
            <PdfMock />
          </Scene>
          <Scene cls="md:col-span-2" title="Announcements that stay put" text="Pinned above the conversation, not buried under hundreds of messages.">
            <AnnouncementMock />
          </Scene>
          <Scene cls="md:col-span-2" title="Instant anonymous discussions" text="Ask the question you would never put your name to.">
            <AnonymousMock />
          </Scene>
          <Scene cls="md:col-span-2" title="Sessions you control" text="Open, by request or invite-only, with replies and reactions switched how you want.">
            <SessionMock />
          </Scene>
        </div>

        <div className="lp-reveal mt-3 grid items-center gap-5 rounded-[26px] bg-white/[0.03] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] md:grid-cols-2 md:gap-8 md:p-4">
          <div aria-hidden className="h-[200px] overflow-hidden rounded-[20px]">
            <ChatMock />
          </div>
          <div className="px-2 pb-3 md:px-4">
            <h3 className="text-[19px] font-bold">Chat that feels like your class</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-white/60">
              A proper community chat, with the library and announcements one tab away. Not another noisy group.
            </p>
            <Link href="/login?next=%2Fcommunities" className={`${buttonClass("outline", "mt-4 w-full sm:w-auto")}`}>
              Find your class community
            </Link>
          </div>
        </div>
        <p className="mt-3 text-[12px] text-white/35">Previews are illustrations of how a community looks.</p>
      </div>
    </section>
  );
}

/* ───────────── Social world ───────────── */
const KINDS: [IconName, string][] = [
  ["gallery", "Posts"],
  ["clapperboard", "Reels"],
  ["stars", "Stories"],
  ["filters", "Polls"],
  ["book", "Publications"],
  ["tag", "Listings"],
  ["message", "Messages"],
];

function Social() {
  return (
    <section id="social" className="py-14 md:py-24">
      <div className={`${WRAP} grid items-center gap-10 md:grid-cols-2`}>
        <div className="lp-reveal">
          <Eyebrow>The social world</Eyebrow>
          <h2 className={`${H2} mt-3`}>
            You post. <span className="text-brand">Your campus discovers.</span>
          </h2>
          <p className="mt-4 text-[20px] font-semibold leading-snug">No followers required. No paid boosts.</p>
          <p className="mt-3 max-w-[46ch] text-[16px] leading-relaxed text-white/60">
            Share what you&apos;re making, thinking and selling with the people around you. Reach is never guaranteed, but it is never for sale either.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {KINDS.map(([icon, label]) => (
              <li key={label} className="flex h-9 items-center gap-1.5 rounded-full bg-white/[0.07] px-3.5 text-[13px] font-semibold">
                <Icon name={icon} className="size-4 text-brand" /> {label}
              </li>
            ))}
          </ul>
        </div>
        <div aria-hidden className="lp-reveal relative mx-auto h-[360px] w-[300px] md:h-[470px] md:w-[380px]">
          <img src="/brand/auth/reel.jpg" alt="" width={200} height={400} loading="lazy" decoding="async" className="absolute left-0 top-10 h-[320px] w-[164px] -rotate-6 rounded-[28px] object-cover object-top shadow-[0_26px_60px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.1)] md:h-[420px] md:w-[210px]" />
          <img src="/brand/auth/profile.jpg" alt="" width={200} height={400} loading="lazy" decoding="async" className="absolute right-0 top-0 h-[320px] w-[164px] rotate-[5deg] rounded-[28px] object-cover object-top shadow-[0_26px_60px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.1)] md:h-[420px] md:w-[210px]" />
        </div>
      </div>
    </section>
  );
}

/* ───────────── Hustle. Flex. Earn. ───────────── */
async function ListingsStrip() {
  const { tiles } = await getLandingData();
  const listings = tiles.filter((t) => t.kind === "listing").slice(0, 4);
  if (listings.length === 0) return null;
  return (
    <div className="mt-10">
      <h3 className="mb-3 text-[13px] font-bold uppercase tracking-[0.14em] text-white/45">On the marketplace</h3>
      <div className="lp-rail" style={{ ["--cols" as string]: 4 }}>
        {listings.map((t) => (
          <Tile key={t.id} t={t} />
        ))}
      </div>
    </div>
  );
}

function Hustle() {
  const items: [string, IconName, string][] = [
    ["Hustle.", "shop", "Discover businesses, sell products and offer services to the people closest to you."],
    ["Flex.", "camera", "Share your world, create content and express yourself."],
    ["Earn.", "suitcase", "Turn your skills, creativity and opportunities into something valuable."],
  ];
  return (
    <section id="hustle" className="bg-white/[0.02] py-14 md:py-24">
      <div className={WRAP}>
        <div className="lp-reveal max-w-2xl">
          <Eyebrow>Our signature</Eyebrow>
          <h2 className={`${H2} mt-3`}>Hustle. Flex. Earn.</h2>
        </div>
        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {items.map(([word, icon, text]) => (
            <div key={word} className="lp-reveal rounded-[26px] bg-[#111114] p-6 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
              <Icon name={icon} filled className="size-7 text-brand" />
              <p className={`${display.className} lp-display mt-5 text-[40px] leading-none tracking-[-0.02em]`}>{word}</p>
              <p className="mt-3 text-[15px] leading-relaxed text-white/60">{text}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-white/40">Anaija doesn&apos;t pay you or promise income. It gives your work somewhere to be found.</p>
        <Suspense fallback={null}>
          <ListingsStrip />
        </Suspense>
      </div>
    </section>
  );
}

/* ───────────── Class representatives ───────────── */
function ClassReps() {
  const steps = ["Start a community for your class.", "Add your materials to its library.", "Share one invite link."];
  return (
    <section id="class-reps" className="py-14 md:py-24">
      <div className={WRAP}>
        <div className="lp-reveal relative overflow-hidden rounded-[32px] bg-[#111114] p-6 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] md:p-12">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[radial-gradient(closest-side,rgba(255,216,77,0.14),transparent)]" />
          <Eyebrow>For class representatives</Eyebrow>
          <p className={`${display.className} lp-display relative mt-4 max-w-3xl text-[clamp(1.5rem,4.6vw,2.4rem)] leading-[1.18] tracking-[-0.015em]`}>
            What if your entire class had one place for lecture materials, past questions, announcements and anonymous discussions, without everything getting buried in WhatsApp?
          </p>
          <ol className="relative mt-8 grid gap-3 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-4 text-[14px] font-semibold">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-[13px] font-extrabold text-brand-fg">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <Link href={CLASS_REP} className={buttonClass("primary", "relative mt-8 w-full sm:w-auto sm:px-8")}>
            Bring your class to Anaija
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ───────────── Closing + footer ───────────── */
function Closing() {
  return (
    <section className="relative overflow-hidden pb-16 pt-6 md:pb-28">
      <div aria-hidden className="lp-glow opacity-70" />
      <div className={`${WRAP} lp-reveal relative text-center`}>
        <h2 className={`${display.className} lp-display mx-auto max-w-3xl text-[clamp(2rem,7vw,3.8rem)] leading-[1.06] tracking-[-0.025em]`}>
          Your campus is more than classrooms, lectures and group chats.
        </h2>
        <p className="mx-auto mt-5 max-w-[34ch] text-[18px] leading-snug text-white/65">There is an entire world happening around you.</p>
        <p className="mt-2 text-[22px] font-extrabold text-brand">Be part of it.</p>
        <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <Link href={JOIN} className={buttonClass("primary", "sm:px-10")}>Join Anaija</Link>
          <a href="#discover" className={buttonClass("outline", "sm:px-10")}>Keep exploring</a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-8" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 32px)" }}>
      <div className={`${WRAP} flex flex-col items-center justify-between gap-4 text-[13px] text-white/45 sm:flex-row`}>
        <AppLogo size={24} />
        <p>Hustle. Flex. Earn.</p>
        <div className="flex gap-5">
          <Link href="/login" className="hover:text-white">Sign in</Link>
          <Link href="/watch" className="hover:text-white">Reels</Link>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  const site = abs("/");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Anaija",
    description: "The social home for campus life.",
    ...(site.startsWith("http") ? { url: site } : {}),
  };
  return (
    <div className={`lp ${display.variable} relative min-h-dvh overflow-x-clip bg-bg text-fg`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:font-bold focus:text-brand-fg">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <Discover />
        <Communities />
        <Social />
        <Hustle />
        <ClassReps />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}
