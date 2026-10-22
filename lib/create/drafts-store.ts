// Web twin of SecureStorage.saveDraft / getAllDraftsJson / deleteDraft.
import { idbAll, idbDelete, idbGet, idbPut } from "./idb";
import type { ContentDraft } from "./types";

export async function saveDraft(d: ContentDraft): Promise<string> {
  const id = d.draftId ?? String(Date.now());
  await idbPut("drafts", { ...d, draftId: id, savedAtMs: Date.now() });
  return id;
}

export async function listDrafts(): Promise<ContentDraft[]> {
  const all = await idbAll<ContentDraft>("drafts");
  return all.sort((a, b) => (b.savedAtMs ?? 0) - (a.savedAtMs ?? 0));
}

export const getDraft = (id: string) => idbGet<ContentDraft>("drafts", id);
export const deleteDraft = (id: string) => idbDelete("drafts", id);
