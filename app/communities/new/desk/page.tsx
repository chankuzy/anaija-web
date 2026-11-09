import type { Metadata } from "next";
import { CreateDesk } from "@/components/community/create-desk";

export const metadata: Metadata = { title: "New Course Desk" };

export default function Page() {
  return <CreateDesk />;
}
