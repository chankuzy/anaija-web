import type { Metadata } from "next";
import { CreateView } from "@/components/create/create-view";

export const metadata: Metadata = { title: "Create" };

const KINDS = ["post", "story", "listing"] as const;

// /create?mode=story opens the composer with the Story tab selected (the + on your own avatar uses this).
export default async function CreatePage({ searchParams }: { searchParams: Promise<{ mode?: string | string[] }> }) {
  const { mode } = await searchParams;
  const m = Array.isArray(mode) ? mode[0] : mode;
  const initialKind = KINDS.find((k) => k === m) ?? "post";
  return <CreateView key={initialKind} initialKind={initialKind} />;
}
