"use client";
import { openAuth } from "@/lib/auth/auth-modal";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ProfileSkeleton, ProfileView } from "@/components/profile/profile-view";
import { useAuth } from "@/lib/auth/auth-context";

export default function MePage() {
  const router = useRouter();
  const { status, user } = useAuth();

  useEffect(() => {
    if (status === "guest") openAuth();
  }, [status, router]);

  if (status !== "authed" || !user?.username) return <ProfileSkeleton />;
  return <ProfileView key={user.username} username={user.username} />;
}
