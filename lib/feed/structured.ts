import type { Post } from "@/lib/api/feed-types";

// Payloads of the structured kinds. Server twin: supabase/functions/_shared/services/contentKinds.ts.
export interface PollContent {
  kind: "poll";
  question: string;
  options: { id: number; text: string }[];
  multiple: boolean;
  closes_at: string | null;
}
export interface DocumentContent {
  kind: "document";
  title: string;
  description: string;
  file: { name: string; size?: number; mime?: string };
}
export type ArticleBlock = { type: "heading" | "paragraph" | "quote"; text: string } | { type: "list"; items: string[] };
export interface ArticleContent {
  kind: "article";
  headline: string;
  subtitle: string;
  blocks: ArticleBlock[];
  read_minutes: number;
}
export interface AnnouncementContent {
  kind: "announcement";
  title: string;
  body: string;
  event_at: string | null;
  deadline_at: string | null;
  publisher: { id: number; name: string; type: string } | null;
}
export type StructuredContent = PollContent | DocumentContent | ArticleContent | AnnouncementContent;

/** Only returns a payload whose shape is usable; anything else renders as a plain post. */
export function structuredOf(p: Post): StructuredContent | null {
  const c = p.content;
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, unknown>;
  switch (o.kind) {
    case "poll":
      return Array.isArray(o.options) && typeof o.question === "string" ? (o as unknown as PollContent) : null;
    case "document":
      return typeof o.title === "string" ? (o as unknown as DocumentContent) : null;
    case "article":
      return typeof o.headline === "string" && Array.isArray(o.blocks) ? (o as unknown as ArticleContent) : null;
    case "announcement":
      return typeof o.title === "string" ? (o as unknown as AnnouncementContent) : null;
    default:
      return null;
  }
}

export function formatBytes(n: number | null | undefined): string {
  if (!n || n <= 0) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function fileLabel(mime?: string, name?: string): string {
  const m = mime ?? "";
  const ext = (name?.split(".").pop() ?? "").toLowerCase();
  if (m === "application/pdf" || ext === "pdf") return "PDF";
  if (m.includes("word") || ext === "doc" || ext === "docx") return "DOC";
  if (m.includes("presentation") || m.includes("powerpoint") || ext === "ppt" || ext === "pptx") return "PPT";
  if (m.includes("sheet") || m.includes("excel") || ext === "xls" || ext === "xlsx") return "XLS";
  if (m === "text/plain" || ext === "txt") return "TXT";
  return "FILE";
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(d);
}
