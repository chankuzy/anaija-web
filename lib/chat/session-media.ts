// Files added in this tab, so the picker can show "recently added". Holds references (disk-backed Files) and
// small thumbnails only, never a copy of the media, and is dropped on sign-out / reload.
import { onCacheClear } from "@/lib/cache/swr";
import type { PickedFile } from "./types";

const MAX = 30;
let items: PickedFile[] = [];
onCacheClear(() => {
  items = [];
});

export const sessionMedia = {
  list: (): readonly PickedFile[] => items,
  add(added: PickedFile[]) {
    const ids = new Set(added.map((a) => a.id));
    items = [...added, ...items.filter((i) => !ids.has(i.id))].slice(0, MAX);
  },
};
