import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/auth-context";
import { ActivityProvider } from "@/lib/activity/activity-context";
import { NotificationsPanelProvider } from "@/lib/notifications/panel-context";
import { PlaybackProvider } from "@/components/feed/playback-context";
import { AppShell } from "@/components/shell/app-shell";
import { UploadDock } from "@/components/create/upload-dock";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Anaija — Hustle. Flex. Earn.", template: "%s · Anaija" },
  description: "Anaija — Hustle. Flex. Earn.",
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AuthProvider>
          <ActivityProvider>
            <NotificationsPanelProvider>
              <PlaybackProvider>
                <AppShell>{children}</AppShell>
                <Suspense fallback={null}><UploadDock /></Suspense>
              </PlaybackProvider>
            </NotificationsPanelProvider>
          </ActivityProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
