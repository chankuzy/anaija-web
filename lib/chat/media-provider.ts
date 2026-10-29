// The picker UI only talks to this interface. A native Android wrapper can register a provider whose
// `library()` lists the real device gallery, and the same UI shows it with no rewrite.
import type { PickedFile } from "./types";

export interface MediaProvider {
  readonly id: string;
  /** "session": only files the user added in this tab. "device": a real gallery listing. */
  readonly scope: "session" | "device";
  /** Opens the system picker. Must be called straight from a tap. */
  pick(opts: { multiple: boolean; video: boolean }): Promise<File[]>;
  /** Optional. Native providers implement this; the web provider cannot enumerate a gallery. */
  library?(opts: { limit: number; cursor?: string | null }): Promise<{ items: PickedFile[]; next: string | null }>;
}

// The plain file input is the best web option: on Android and iOS it opens the system photo picker.
// showOpenFilePicker is desktop Chromium only, so it would add nothing on phones and is deliberately not used.
const fileInput: MediaProvider = {
  id: "file-input",
  scope: "session",
  pick: ({ multiple, video }) =>
    new Promise<File[]>((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = video ? "image/*,video/*" : "image/*";
      input.multiple = multiple;
      input.style.display = "none";
      let done = false;
      const finish = (files: File[]) => {
        if (done) return;
        done = true;
        input.remove();
        resolve(files);
      };
      input.addEventListener("change", () => finish(Array.from(input.files ?? [])));
      input.addEventListener("cancel", () => finish([]));
      document.body.appendChild(input);
      input.click();
    }),
};

let current: MediaProvider = fileInput;
export const getMediaProvider = () => current;
export const setMediaProvider = (p: MediaProvider) => {
  current = p;
};
