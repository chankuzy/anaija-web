export interface PickedFile {
  id: string;
  kind: "image" | "video";
  /** What gets sent: the edited export once edited, otherwise the original. */
  file: File;
  /** The untouched original. Edits always start from it, so nothing is lost. */
  original: File;
  /** Small JPEG preview (about 320px), never the full file. */
  thumb: Blob | null;
  edited: boolean;
  durationMs?: number;
}
