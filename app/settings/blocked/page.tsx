import type { Metadata } from "next";
import { BlockedView } from "@/components/settings/blocked-view";

export const metadata: Metadata = { title: "Blocked accounts" };

export default function Page() {
  return <BlockedView />;
}
