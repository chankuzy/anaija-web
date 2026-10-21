"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { needsProfileSetup } from "@/lib/auth/guards";
import { useAuth } from "@/lib/auth/auth-context";
import { Icon, type IconName } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/button";
import { AppLogo } from "@/components/ui/app-logo";
import { Avatar } from "@/components/ui/avatar";
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

const SIDE = NAV.filter((n) => n.mobile !== "create");
const CREATE = NAV.find((n) => n.mobile === "create")!;

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
      <aside className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col justify-between border-r border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),transparent_38%)] px-3 py-6 md:flex lg:w-[256px] lg:px-4">
        <div className="flex flex-col">
          <Link href="/" aria-label="Anaija home" className="mb-8 flex h-11 items-center justify-center lg:justify-start lg:px-3">
            <span className="lg:hidden">
              <AppLogo size={34} showWordmark={false} />
            </span>
            <span className="hidden lg:inline">
              <AppLogo size={34} />
            </span>
          </Link>

          <nav className="flex flex-col gap-1.5">
            {SIDE.map((n) => {
              const active = isActive(n.href);
              return (
                <Link
                  key={n.href}
                  href={hrefFor(n)}
                  title={n.label}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-[52px] items-center justify-center gap-4 rounded-full text-[15px] transition-colors lg:justify-start lg:px-4 ${
                    active
                      ? "bg-white/10 font-bold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                      : "font-medium text-white/60 hover:bg-white/6 hover:text-white"
                  }`}
                >
                  <Icon name={n.icon} filled={active} className="size-8 shrink-0" />
                  <span className="hidden lg:inline">{n.label}</span>
                </Link>
              );
            })}
          </nav>

          <Link
            href={hrefFor(CREATE)}
            title="Create"
            className="mt-6 flex h-12 items-center justify-center gap-2.5 rounded-full bg-white text-[15px] font-bold text-black shadow-[0_8px_28px_rgba(255,255,255,0.14)] transition hover:bg-white/92 hover:shadow-[0_10px_34px_rgba(255,255,255,0.24)] active:scale-[0.98]"
          >
            <Icon name="plus" weight="strong" className="size-7" />
            <span className="hidden lg:inline">Create</span>
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          {status === "authed" && (
            <div className="flex flex-col items-center gap-2 border-t border-white/8 pt-4 lg:flex-row lg:justify-between lg:px-1">
              <Link href="/me" className="flex min-w-0 items-center gap-3">
                <Avatar
                  url={(user as { avatar_url?: string | null } | null)?.avatar_url}
                  name={user?.name ?? user?.username}
                  size={38}
                />
                <span className="hidden min-w-0 lg:block">
                  <span className="block truncate text-body font-semibold text-white">{user?.name ?? ""}</span>
                  <span className="block truncate text-supporting text-white/50">{user?.username ? `@${user.username}` : ""}</span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                aria-label="Sign out"
                title="Sign out"
                className="grid size-10 shrink-0 place-items-center rounded-full text-white/50 transition-colors hover:bg-white/8 hover:text-white"
              >
                <Icon name="logout" className="size-7" />
              </button>
            </div>
          )}
          {status === "guest" && (
            <>
              <div className="hidden lg:block">
                <LinkButton href="/login" className="w-full">
                  Sign in
                </LinkButton>
              </div>
              <Link href="/login" title="Sign in" className="flex h-12 items-center justify-center rounded-full bg-white text-black lg:hidden">
                <Icon name="user" className="size-7" />
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
        className="fixed inset-x-0 bottom-0 z-40 flex bg-[rgba(10,10,10,0.72)] backdrop-blur-[24px] md:hidden"
        style={{ height: "calc(var(--nav-h) + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV.filter((n) => n.mobile).map((n) =>
          n.mobile === "create" ? (
            <Link key={n.href} href={hrefFor(n)} aria-label="Create" className="flex flex-1 items-center justify-center">
              <span className="grid h-[30px] w-11 place-items-center rounded-[10px] bg-white text-black">
                <Icon name="plus" className="size-[22px]" />
              </span>
            </Link>
          ) : (
            <Link
              key={n.href}
              href={hrefFor(n)}
              className={`flex flex-1 flex-col items-center justify-center gap-[3px] text-micro ${
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
