import { cacheLife, cacheTag } from "next/cache";
import { callFunction } from "@/lib/server/upstream";

// Metadata only. Name is public by design (unlisted still resolves by link); description only when the community previews publicly.
async function fetchCommunity(slug: string): Promise<{ name: string; description: string | null; image: string | null; cover: boolean } | null> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });
  cacheTag(`community:${slug.toLowerCase()}`);
  const res = await callFunction(`communities/show/${encodeURIComponent(slug)}`);
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`communities/show ${res.status}`);
  const j = (await res.json()) as { community?: { name: string; description: string | null; read_policy: string } & Record<string, unknown> };
  const c = j.community;
  if (!c) return null;
  const https = (v: unknown) => (typeof v === "string" && /^https:\/\//i.test(v) ? v : null);
  const cover = https(c.cover);
  const image = cover ?? https(c.avatar);
  return { name: c.name, description: c.read_policy === "public_preview" ? c.description : null, image, cover: !!cover };
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

async function fetchInvite(token: string): Promise<{ name: string; slug: string; members: number } | null> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 600 });
  cacheTag(`invite:${token}`);
  const res = await callFunction(`communities/invite-preview/${encodeURIComponent(token)}`);
  if (!res.ok) return null;
  const j = (await res.json()) as { state?: string; community?: { name: string; slug: string; members_count: number } };
  return j.state === "valid" && j.community ? { name: j.community.name, slug: j.community.slug, members: j.community.members_count } : null;
}
export async function getInviteMeta(token: string) {
  if (!/^[a-z0-9_-]{8,128}$/i.test(token)) return null;
  try { return await fetchInvite(token); } catch { return null; }
}
