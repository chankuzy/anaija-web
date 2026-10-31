"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { AppShell } from "@/components/shell/app-shell";

// Signed-out visitors on "/" get the landing page with no app chrome (no tab bar, no rail). Everything else is unchanged.
export function ShellGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { status } = useAuth();
  if (pathname === "/" && status === "guest") return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}
