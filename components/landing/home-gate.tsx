"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { AppLogo } from "@/components/ui/app-logo";

// The server sends only the variant it knows is needed (guest -> landing, signed in -> feed, unsure -> both).
// If the client's session later disagrees (sign-out, expiry), ask the server for the other variant once.
export function HomeGate({ guest, children }: { guest: ReactNode; children: ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();
  const missing = (status === "authed" && !children) || (status === "guest" && !guest);
  useEffect(() => {
    if (missing) router.refresh();
  }, [missing, router]);

  if (status === "authed" && children) return <>{children}</>;
  if (status === "guest" && guest) return <>{guest}</>;
  return (
    <div className="grid h-dvh place-items-center">
      <AppLogo size={56} showWordmark={false} />
    </div>
  );
}
