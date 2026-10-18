import { notFound } from "next/navigation";
import { ProbeClient } from "@/components/dev/probe-client";

export default function ProbePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ProbeClient />;
}
