import type { Metadata } from "next";
import { CreateCommunity } from "@/components/community/create-community";
import { DeskEntry } from "@/components/community/create-desk";

export const metadata: Metadata = { title: "New community" };

export default function Page() {
  return (
    <>
      <DeskEntry />
      <CreateCommunity />
    </>
  );
}
