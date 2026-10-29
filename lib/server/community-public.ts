import { cacheLife, cacheTag } from "next/cache";
import { callFunction } from "@/lib/server/upstream";

// Metadata only. Name is public by design (unlisted still resolves by link); description only when the community previews publicly.
async function fetchCommunity(slug: string): Promise<{ name: string; description: string | null; image: string | null } | null> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });
  cacheTag(`community:${slug.toLowerCase()}`);
  const res = await callFunction(`communities/show/${encodeURIComponent(slug)}`);
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`communities/show ${res.status}`);
  const j = (await res.json()) as { community?: { name: string; description: string | null; read_policy: string } & Record<string, unknown> };
  const c = j.community;
  if (!c) return null;
  const pick = [c.avatar_url, c.avatar, c.icon_url, c.cover_url, c.cover, c.image].find((v) => typeof v === "string" && /^https:\/\//i.test(v)) as string | undefined;
  return { name: c.name, description: c.read_policy === "public_preview" ? c.description : null, image: pick ?? null };
}

async function fetchSession(code: string): Promise<{ title: string; community: string } | null> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });
  cacheTag(`session:${code.toLowerCase()}`);
  const res = await callFunction(`communities/session/${encodeURIComponent(code)}`);
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`communities/session ${res.status}`);
  const j = (await res.json()) as { session?: { title: string; community: { name: string } } };
  return j.session ? { title: j.session.title, community: j.session.community.name } : null;
}

export async function getCommunityMeta(slug: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/i.test(slug)) return null;
  try { return await fetchCommunity(slug); } catch { return null; }
}
export async function getSessionMeta(code: string) {
  if (!/^[a-z0-9]{6,20}$/i.test(code)) return null;
  try { return await fetchSession(code); } catch { return null; }
}
