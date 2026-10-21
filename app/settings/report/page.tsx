import type { Metadata } from "next";
import { ReportView } from "@/components/settings/report-view";

export const metadata: Metadata = { title: "Report a problem" };

export default function Page() {
  return <ReportView />;
}
