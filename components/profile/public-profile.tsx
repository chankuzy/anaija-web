/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { formatCount } from "@/lib/format";
import type { PublicProfile } from "@/lib/server/public";

// Same cover treatment as the signed-in profile: fades into the page on the left, right and bottom.
const COVER_MASK =
  "linear-gradient(to bottom, #000 0%, #000 45%, transparent 100%), linear-gradient(to right, transparent 0%, #000 22%, #000 78%, transparent 100%)";
const WARM_GLOW = "bg-[radial-gradient(70%_90%_at_18%_0%,rgba(255,216,77,0.08),transparent_70%)]";

export function PublicProfileView({ p }: { p: PublicProfile }) {
  const login = `/login?next=${encodeURIComponent(`/u/${p.username}`)}`;
  const total = p.counts.posts + p.counts.listings;
  const bio = (p.bio ?? "").trim() || (p.tagline ?? "").trim();

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[935px] pb-20">
      <section className="relative isolate overflow-hidden">
        {p.cover ? (
          <>
            <img
              src={p.cover}
              alt=""
              decoding="async"
              className="absolute inset-0 -z-20 size-full object-cover saturate-[0.6]"
              style={{ WebkitMaskImage: COVER_MASK, maskImage: COVER_MASK, WebkitMaskComposite: "source-in", maskComposite: "intersect" }}
            />
            <span className="absolute inset-0 -z-10 bg-gradient-to-b from-black/45 via-black/55 to-black/72" />
          </>
        ) : (
          <span className={`absolute inset-0 -z-10 ${WARM_GLOW}`} />
        )}

        <Link
          href="/"
          aria-label="Anaija home"
          className="absolute left-3 z-10 rounded-full bg-black/45 px-3.5 py-2 text-supporting font-bold text-white"
          style={{ top: "calc(10px + env(safe-area-inset-top))" }}
        >
          Anaija
        </Link>

        <div className="relative px-4 pb-3 md:px-6 md:pb-6" style={{ paddingTop: "calc(env(safe-area-inset-top) + 64px)" }}>
          <div className="flex items-start justify-between gap-4 md:flex-row-reverse md:justify-end md:gap-9">
            <div className="shrink-0">
              <Avatar url={p.avatar} name={p.name ?? p.username} size={96} />
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <h1 className="truncate text-[25px] font-extrabold leading-[1.1] tracking-tight text-white text-shadow">
                {p.name ?? p.username}
              </h1>
              <p className="mt-0.5 truncate text-[15px] text-white/55 text-shadow">
                @{p.username}
                {p.institution ? ` · ${p.institution}` : ""}
              </p>
              <div className="mt-3.5 flex items-start gap-7">
                <div>
                  <p className="text-[21px] font-extrabold leading-none tracking-tight text-white text-shadow">{formatCount(p.counts.followers)}</p>
                  <p className="mt-1 text-body text-white/55">Followers</p>
                </div>
                <div>
                  <p className="text-[21px] font-extrabold leading-none tracking-tight text-white text-shadow">{formatCount(total)}</p>
                  <p className="mt-1 text-body text-white/55">Posts</p>
                </div>
              </div>
            </div>
          </div>

          {bio && <p className="mt-3 line-clamp-4 whitespace-pre-line text-[15px] leading-[1.4] text-white/90 text-shadow md:max-w-[620px]">{bio}</p>}

          <Link
            href={login}
            className="mt-3.5 flex h-11 w-full items-center justify-center rounded-xl bg-brand text-[15px] font-bold text-brand-fg transition hover:bg-brand-hover active:scale-98 md:w-auto md:min-w-[148px] md:rounded-full md:px-7"
          >
            Follow
          </Link>
        </div>
      </section>

      <div className="flex md:px-6">
        <span className="relative px-5 py-2.5 text-label font-bold text-white md:px-0">
          Posts
          <span className="absolute bottom-0 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-full bg-brand md:inset-x-0 md:left-0 md:w-auto md:translate-x-0" />
        </span>
      </div>

      {p.tiles.length > 0 ? (
        <div className="grid grid-cols-3 gap-[3px] pt-0.5 md:px-6 md:pt-4">
          {p.tiles.map((t) => (
            <Link
              key={t.id}
              href={t.type === "listing" ? `/l/${t.id}` : `/p/${t.id}`}
              className="relative aspect-[3/4] overflow-hidden bg-card"
            >
              {t.thumbnail && <img src={t.thumbnail} alt="" loading="lazy" decoding="async" className="size-full object-cover" />}
              {t.type === "listing" && (
                <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-micro font-bold text-white">Listing</span>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-10 text-center text-secondary text-muted">No public posts yet</p>
      )}

      <div className="mt-8 px-5 text-center">
        <Link href={login} className="inline-block rounded-full bg-surface-interactive px-5 py-2.5 text-[14px] font-bold text-fg">
          Join Anaija to follow @{p.username}
        </Link>
      </div>
    </main>
  );
}
