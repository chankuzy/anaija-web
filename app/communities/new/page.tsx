import type { Metadata } from "next";
import { CreateCommunity } from "@/components/community/create-community";

export const metadata: Metadata = { title: "New community" };

export default function Page() {
  return <CreateCommunity />;
}
