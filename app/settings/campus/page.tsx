import type { Metadata } from "next";
import { CampusView } from "@/components/settings/campus-view";

export const metadata: Metadata = { title: "Campus & Institution" };

export default function Page() {
  return <CampusView />;
}
