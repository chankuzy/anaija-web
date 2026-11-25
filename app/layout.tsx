import { Suspense } from "react";
import Script from "next/script";
import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { AuthRoot } from "@/components/shell/auth-root";
import { CacheCurtain } from "@/components/shell/cache-curtain";
import { AppLogo } from "@/components/ui/app-logo";
import { DEFAULT_THEME } from "@/lib/theme/default";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Wordmark only: one weight keeps the download to a single small file.
const manrope = Manrope({ subsets: ["latin"], weight: ["800"], variable: "--font-manrope", display: "swap" });

// Runs before first paint so the chosen theme never flashes. Preference: "light" | "dark" | "system" in localStorage.
const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem("anaija:theme"),d=${JSON.stringify(DEFAULT_THEME)},m=s==="light"||s==="dark"?s:s==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):d;document.documentElement.setAttribute("data-theme",m);var t=document.querySelector('meta[name="theme-color"]');if(t)t.setAttribute("content",m==="dark"?"#09090b":"#ffffff")}catch(e){document.documentElement.setAttribute("data-theme",${JSON.stringify(DEFAULT_THEME)})}})();`;

const site = process.env.NEXT_PUBLIC_SITE_URL;

// The browser fires beforeinstallprompt once, often before hydration. Catch it here so it is never missed.
const INSTALL_CAPTURE =
  'window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__anaijaBip=e;window.dispatchEvent(new Event("anaija:bip"))});' +
  'window.addEventListener("appinstalled",function(){window.__anaijaBip=null;try{localStorage.setItem("anaija:installed","1")}catch(_){}});';

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
  colorScheme: "light dark",
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
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
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${manrope.variable}`}>
      <body>
        <Script id="anaija-install-capture" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: INSTALL_CAPTURE }} />
        <Script id="anaija-theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <Suspense fallback={<Splash />}>
          <AuthRoot>{children}</AuthRoot>
        </Suspense>
        <CacheCurtain />
      </body>
    </html>
  );
}
