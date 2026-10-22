import type { Metadata } from "next";
import { Suspense } from "react";
import { Composer } from "@/components/create/composer";
import type { ContentKind } from "@/lib/create/types";

export const metadata: Metadata = { title: "Create" };

const KINDS: ContentKind[] = ["reel", "story", "listing"];

async function CreatePageContent({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const { mode } = await searchParams;
  const raw = Array.isArray(mode) ? mode[0] : mode;
  const requested = raw === "post" ? "reel" : raw; // legacy links
  const initialKind = KINDS.find((kind) => kind === requested) ?? "reel";

  return <Composer key={initialKind} initialKind={initialKind} />;
}

export default function CreateNewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-bg md:static md:h-dvh md:bg-transparent" />}>
      <CreatePageContent searchParams={searchParams} />
    </Suspense>
  );
}
