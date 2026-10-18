import type { Metadata } from "next";
import { ProfileSetup } from "@/components/auth/profile-setup";

export const metadata: Metadata = { title: "Set up your profile" };

export default function SetupPage() {
  return <ProfileSetup />;
}
