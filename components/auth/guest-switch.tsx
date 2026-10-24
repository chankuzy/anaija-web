"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth-context";

// Signed-in users keep the existing screen untouched; everyone else (including crawlers) gets the public one.
export function GuestSwitch({ guest, children }: { guest: ReactNode; children: ReactNode }) {
  const { status } = useAuth();
  return status === "authed" ? children : guest;
}
