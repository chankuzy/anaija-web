"use client";

import { useSyncExternalStore } from "react";
import { uploadManager, type UploadTask } from "./upload-manager";

const EMPTY: readonly UploadTask[] = [];

/** Live list of pending/finished uploads, driven by the app-level upload manager. */
export function useUploads(): readonly UploadTask[] {
  return useSyncExternalStore(uploadManager.subscribe, uploadManager.getSnapshot, () => EMPTY);
}
