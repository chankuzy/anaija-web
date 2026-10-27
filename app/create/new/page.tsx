import { CreateSkeleton } from "@/components/ui/skeleton";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Composer } from "@/components/create/composer";
import { StructuredComposer } from "@/components/create/structured/structured-composer";
import { isStructuredKind } from "@/lib/create/kinds";
import type { ContentKind } from "@/lib/create/types";

export const metadata: Metadata = { title: "Create" };

const MEDIA_KINDS: ContentKind[] = ["reel", "photo", "story", "listing"];

async function CreatePageContent({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const { mode } = await searchParams;
  const raw = Array.isArray(mode) ? mode[0] : mode;
  if (isStructuredKind(raw)) return <StructuredComposer key={raw} kind={raw} />;
  const requested = raw === "post" ? "reel" : raw; // legacy links
  const initialKind = MEDIA_KINDS.find((kind) => kind === requested) ?? "reel";

  return <Composer key={initialKind} initialKind={initialKind} />;
}

export default function CreateNewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<div className="fixed inset-0 overflow-hidden bg-bg md:static md:h-dvh md:bg-transparent"><CreateSkeleton /></div>}>
      <CreatePageContent searchParams={searchParams} />
    </Suspense>
  );
}
