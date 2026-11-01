"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

export interface StaffMe {
  user_id: number;
  role: string;
  capabilities: string[];
}

interface StaffValue extends StaffMe {
  can: (cap: string) => boolean;
}

const Ctx = createContext<StaffValue | null>(null);

// Resolved on the server by the /admin layout. The capability list only shapes the UI; every route re-checks server-side.
export function StaffProvider({ me, children }: { me: StaffMe; children: ReactNode }) {
  const value = useMemo<StaffValue>(() => ({ ...me, can: (cap) => me.capabilities.includes(cap) }), [me]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStaff(): StaffValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStaff must be used inside /admin");
  return v;
}
