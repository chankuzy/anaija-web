import { uploadBlob } from "@/lib/api/upload";
import { prepareImage } from "@/lib/create/image-pipeline";
import type { PickedFile } from "./types";

/** Images are re-encoded (metadata stripped, long edge 1440) and only that copy is uploaded. Videos go up as picked. */
export async function uploadAttachment(a: PickedFile): Promise<{ mediaKey: string; mediaType: string }> {
  if (a.kind === "video") {
    const type = a.file.type || "video/mp4";
    const ext = ((a.file.name.split(".").pop() ?? "mp4").toLowerCase().replace(/[^a-z0-9]/g, "")) || "mp4";
    const key = await uploadBlob(a.file, `chat.${ext}`, type);
    return { mediaKey: key, mediaType: type };
  }
  const p = await prepareImage(a.file);
  const key = await uploadBlob(p.feed, `chat.${p.ext}`, p.contentType);
  return { mediaKey: key, mediaType: p.contentType };
}
