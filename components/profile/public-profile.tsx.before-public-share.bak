/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { formatCount } from "@/lib/format";
import type { PublicProfile } from "@/lib/server/public";

export function PublicProfileView({ p }: { p: PublicProfile }) {
  const login = `/login?next=${encodeURIComponent(`/u/${p.username}`)}`;
  const stats: [number, string][] = [
    [p.counts.posts, "Posts"],
    [p.counts.listings, "Listings"],
    [p.counts.followers, "Followers"],
  ];
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[640px] pb-20">
      <div className="relative h-36 bg-card md:h-48">
        {p.cover && <img src={p.cover} alt="" decoding="async" className="size-full object-cover" />}
        <Link
          href="/"
          aria-label="Anaija home"
          className="absolute left-3 rounded-full bg-black/45 px-3 py-1.5 text-supporting font-bold text-white backdrop-blur"
          style={{ top: "calc(12px + env(safe-area-inset-top))" }}
        >
          Anaija
        </Link>
      </div>

      <div className="px-5">
        <div className="-mt-10 flex items-end justify-between">
          <div className="rounded-full border-4 border-bg">
            <Avatar url={p.avatar} name={p.name ?? p.username} size={80} />
          </div>
          <Link href={login} className="mb-1 rounded-full bg-white px-5 py-2 text-[14px] font-bold text-black">
            Follow
          </Link>
        </div>

        <h1 className="mt-3 text-[20px] font-bold text-fg">{p.name ?? p.username}</h1>
        <p className="text-secondary text-muted">
          @{p.username}
          {p.institution ? ` · ${p.institution}` : ""}
        </p>
        {p.tagline && <p className="mt-2 text-body text-fg">{p.tagline}</p>}
        {p.bio && <p className="mt-1.5 whitespace-pre-line text-secondary text-white/70">{p.bio}</p>}

        <div className="mt-4 flex gap-6">
          {stats.map(([n, label]) => (
            <p key={label} className="text-secondary text-muted">
              <span className="font-bold text-fg">{formatCount(n)}</span> {label}
            </p>
          ))}
        </div>
      </div>

      {p.tiles.length > 0 ? (
        <div className="mt-6 grid grid-cols-3 gap-1 px-1">
          {p.tiles.map((t) => (
            <Link
              key={t.id}
              href={t.type === "listing" ? `/listing/${t.id}` : `/p/${t.id}`}
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
        <Link href={login} className="inline-block rounded-full border border-white/25 px-5 py-2.5 text-[14px] font-bold text-fg">
          Join Anaija to follow @{p.username}
        </Link>
      </div>
    </main>
  );
}
