import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthRoot } from "@/components/shell/auth-root";
import { AppLogo } from "@/components/ui/app-logo";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const site = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  ...(site ? { metadataBase: new URL(site) } : {}),
  applicationName: "Anaija",
  title: { default: "Anaija — Hustle. Flex. Earn.", template: "%s · Anaija" },
  description: "Anaija — Hustle. Flex. Earn.",
  appleWebApp: { capable: true, title: "Anaija", statusBarStyle: "black" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "Anaija",
    title: "Anaija — Hustle. Flex. Earn.",
    description: "Anaija — Hustle. Flex. Earn.",
  },
  twitter: { card: "summary", title: "Anaija — Hustle. Flex. Earn.", description: "Anaija — Hustle. Flex. Earn." },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  colorScheme: "dark",
  viewportFit: "cover",
};

// Shown from the first byte until the session is known, so a guest/login screen can never flash.
function Splash() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-bg">
      <AppLogo size={56} showWordmark={false} />
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Suspense fallback={<Splash />}>
          <AuthRoot>{children}</AuthRoot>
        </Suspense>
      </body>
    </html>
  );
}
