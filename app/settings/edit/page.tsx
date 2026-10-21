import type { Metadata } from "next";
import { EditProfileView } from "@/components/settings/edit-profile-view";

export const metadata: Metadata = { title: "Edit profile" };

export default function Page() {
  return <EditProfileView />;
}
