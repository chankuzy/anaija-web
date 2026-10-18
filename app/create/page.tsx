import type { Metadata } from "next";
import { CreateView } from "@/components/create/create-view";

export const metadata: Metadata = { title: "Create" };

export default function CreatePage() {
  return <CreateView />;
}
