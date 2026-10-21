import { notFound } from "next/navigation";
import { ThreadPane } from "@/components/messaging/thread-pane";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) notFound();
  return <ThreadPane key={n} conversationId={n} />;
}
