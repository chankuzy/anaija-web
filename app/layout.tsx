import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/auth-context";
import { PlaybackProvider } from "@/components/feed/playback-context";
import { AppShell } from "@/components/shell/app-shell";

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
          <PlaybackProvider>
            <AppShell>{children}</AppShell>
          </PlaybackProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
