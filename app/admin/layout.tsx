import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminGate } from "@/components/admin/admin-gate";

export const metadata: Metadata = {
  title: "Anaija Platform",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
