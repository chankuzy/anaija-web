"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { needsProfileSetup } from "@/lib/auth/guards";
import { useAuth } from "@/lib/auth/auth-context";
import { Icon, type IconName } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/button";
import { AppLogo } from "@/components/ui/app-logo";
import { Suspense } from "react";

type NavItem = { href: string; label: string; icon: IconName; auth?: boolean; mobile?: "tab" | "create" };

// Matches main_shell.dart: Home, Discover, [Create], Messages, Profile. Guests get sent to sign-in for
// anything but Home (same rule as Flutter's _onTabTapped). Notifications is the bell in the feed top bar
// on mobile; it gets a sidebar entry on tablet/desktop.
const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: "home", mobile: "tab" },
  { href: "/discover", label: "Discover", icon: "compass", auth: true, mobile: "tab" },
  { href: "/create", label: "Create", icon: "plus", auth: true, mobile: "create" },
  { href: "/messages", label: "Messages", icon: "message", auth: true, mobile: "tab" },
  { href: "/notifications", label: "Notifications", icon: "bell", auth: true },
  { href: "/me", label: "Profile", icon: "user", auth: true, mobile: "tab" },
];

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <AppShellContent>{children}</AppShellContent>
    </Suspense>
  );
}

export function AppShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { status, user, signOut } = useAuth();

  const router = useRouter();
  useEffect(() => {
    if (status === "authed" && needsProfileSetup(user) && pathname !== "/setup" && pathname !== "/login") {
      router.replace("/setup");
    }
  }, [status, user, pathname, router]);

  if (pathname === "/login" || pathname === "/setup") return <>{children}</>;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const hrefFor = (n: NavItem) => (n.auth && status === "guest" ? "/login" : n.href);
  // Home is full-bleed under the glass bar (it lifts its own overlays); other pages reserve the bar's space.
  const fullBleed = pathname === "/";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1440px]">
      {/* Tablet rail (md) / desktop sidebar (lg) */}
      <aside className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col justify-between border-r border-line px-3 py-5 md:flex lg:w-[248px] lg:px-4">
        <div className="flex flex-col gap-1">
          <Link href="/" className="mb-4 px-2">
            <span className="lg:hidden">
              <AppLogo size={32} showWordmark={false} />
            </span>
            <span className="hidden lg:inline">
              <AppLogo size={32} />
            </span>
          </Link>
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={hrefFor(n)}
              title={n.label}
              className={`flex h-12 items-center gap-4 rounded-full px-3.5 text-[15px] font-semibold transition-colors ${
                isActive(n.href) ? "bg-card text-fg" : "text-muted hover:bg-card hover:text-fg"
              }`}
            >
              <Icon name={n.icon} filled={isActive(n.href)} />
              <span className="hidden lg:inline">{n.label}</span>
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {status === "authed" && (
            <>
              <p className="hidden truncate px-3.5 text-sm text-muted lg:block">
                {user?.username ? `@${user.username}` : (user?.name ?? "")}
              </p>
              <button
                onClick={() => void signOut()}
                className="h-10 rounded-full text-[11px] font-semibold text-muted hover:bg-card hover:text-fg lg:text-sm"
              >
                Sign out
              </button>
            </>
          )}
          {status === "guest" && (
            <>
              <div className="hidden lg:block">
                <LinkButton href="/login" className="w-full">
                  Sign in
                </LinkButton>
              </div>
              <Link
                href="/login"
                title="Sign in"
                className="flex h-12 items-center justify-center rounded-full bg-accent text-white lg:hidden"
              >
                <Icon name="user" />
              </Link>
            </>
          )}
        </div>
      </aside>

      <main
        className="min-w-0 flex-1"
        style={{ paddingBottom: fullBleed ? undefined : "calc(var(--nav-h) + env(safe-area-inset-bottom))" }}
      >
        {children}
      </main>

      {/* Mobile bottom tabs (glass, per _BottomNav) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex bg-[rgba(7,11,9,0.72)] backdrop-blur-[24px] md:hidden"
        style={{ height: "calc(var(--nav-h) + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV.filter((n) => n.mobile).map((n) =>
          n.mobile === "create" ? (
            <Link key={n.href} href={hrefFor(n)} aria-label="Create" className="flex flex-1 items-center justify-center">
              <span className="grid h-[30px] w-11 place-items-center rounded-[10px] border-[1.5px] border-white/60 text-white/60">
                <Icon name="plus" className="size-[22px]" />
              </span>
            </Link>
          ) : (
            <Link
              key={n.href}
              href={hrefFor(n)}
              className={`flex flex-1 flex-col items-center justify-center gap-[3px] text-[10.5px] ${
                isActive(n.href) ? "font-bold text-white" : "font-medium text-white/60"
              }`}
            >
              <Icon name={n.icon} filled={isActive(n.href)} />
              {n.label}
            </Link>
          ),
        )}
      </nav>
    </div>
  );
}
