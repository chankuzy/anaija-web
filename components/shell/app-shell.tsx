"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { needsProfileSetup } from "@/lib/auth/guards";
import { useAuth } from "@/lib/auth/auth-context";
import { Icon, type IconName } from "@/components/ui/icon";
import { AppLogo } from "@/components/ui/app-logo";
import { Avatar } from "@/components/ui/avatar";
import { Suspense } from "react";

type NavItem = { href: string; label: string; icon: IconName; auth?: boolean; mobile?: "tab" | "create" };

// Matches main_shell.dart: Home, Discover, [Create], Messages, Profile. Guests get sent to sign-in for
// anything but Home (same rule as Flutter's _onTabTapped). Notifications is the bell in the feed top bar
// on mobile; it gets a sidebar entry on tablet/desktop.
const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: "home", mobile: "tab" },
  { href: "/discover", label: "Discover", icon: "search", auth: true, mobile: "tab" },
  { href: "/create", label: "Create", icon: "plus", auth: true, mobile: "create" },
  { href: "/messages", label: "Messages", icon: "message", auth: true, mobile: "tab" },
  { href: "/notifications", label: "Notifications", icon: "bell", auth: true },
  { href: "/me", label: "Profile", icon: "user", auth: true, mobile: "tab" },
];

const SIDE = NAV.filter((n) => n.mobile !== "create");
const CREATE = NAV.find((n) => n.mobile === "create")!;

// Sidebar labels live in the DOM at all times and just fade in while the rail is hovered/focused.
const LABEL = "whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/side:opacity-100 group-focus-within/side:opacity-100";
const ITEM = "flex h-[52px] items-center gap-4 rounded-full px-[10px] text-[15px] transition-colors";

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
    // Home: no width cap, sidebar hugs the screen edge (TikTok-style). Other pages keep the 1440px column.
    <div className={`flex min-h-dvh w-full ${fullBleed ? "" : "mx-auto max-w-[1440px]"}`}>
      {/* Rail (md+): reserves 76px; the aside inside grows over the page on hover and shrinks back on leave. */}
      <div className="relative z-40 hidden w-[76px] shrink-0 md:block">
        <aside className="group/side sticky top-0 flex h-dvh w-[76px] flex-col justify-between overflow-hidden border-r border-white/8 px-3 py-6 transition-[width,background-color,box-shadow] duration-200 ease-out hover:w-[256px] hover:bg-bg/92 hover:shadow-[12px_0_48px_rgba(0,0,0,0.55)] hover:backdrop-blur-xl focus-within:w-[256px] focus-within:bg-bg/92 focus-within:shadow-[12px_0_48px_rgba(0,0,0,0.55)] focus-within:backdrop-blur-xl">
          <div className="flex flex-col">
            <Link href="/" aria-label="Anaija home" className="mb-8 flex h-11 items-center px-[9px]">
              <span className="group-hover/side:hidden group-focus-within/side:hidden">
                <AppLogo size={34} showWordmark={false} />
              </span>
              <span className="hidden group-hover/side:inline group-focus-within/side:inline">
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
                    className={`${ITEM} ${
                      active
                        ? "bg-white/10 font-bold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                        : "font-medium text-white/60 hover:bg-white/6 hover:text-white"
                    }`}
                  >
                    <Icon name={n.icon} filled={active} className="size-8 shrink-0" />
                    <span className={LABEL}>{n.label}</span>
                  </Link>
                );
              })}
            </nav>

            <Link
              href={hrefFor(CREATE)}
              title="Create"
              className="mt-6 flex h-12 items-center gap-2.5 rounded-full bg-white px-3 text-[15px] font-bold text-black shadow-[0_8px_28px_rgba(255,255,255,0.14)] transition hover:bg-white/92 hover:shadow-[0_10px_34px_rgba(255,255,255,0.24)] active:scale-[0.98]"
            >
              <Icon name="plus" weight="strong" className="size-7 shrink-0" />
              <span className={LABEL}>Create</span>
            </Link>
          </div>

          <div className="flex flex-col gap-1.5">
            {status === "authed" && (
              <div className="flex flex-col gap-1.5 border-t border-white/8 pt-4">
                <Link href="/me" title="Profile" className="flex h-[52px] items-center gap-3 rounded-full px-[7px] transition-colors hover:bg-white/6">
                  <Avatar
                    url={(user as { avatar_url?: string | null } | null)?.avatar_url}
                    name={user?.name ?? user?.username}
                    size={38}
                  />
                  <span className={`min-w-0 ${LABEL}`}>
                    <span className="block truncate text-body font-semibold text-white">{user?.name ?? ""}</span>
                    <span className="block truncate text-supporting text-white/50">{user?.username ? `@${user.username}` : ""}</span>
                  </span>
                </Link>
                <Link href="/settings" title="Settings" className={`${ITEM} font-medium text-white/60 hover:bg-white/6 hover:text-white`}>
                  <Icon name="settings" className="size-8 shrink-0" />
                  <span className={LABEL}>Settings</span>
                </Link>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  title="Sign out"
                  className={`${ITEM} w-full font-medium text-white/60 hover:bg-white/6 hover:text-white`}
                >
                  <Icon name="logout" className="size-8 shrink-0" />
                  <span className={LABEL}>Sign out</span>
                </button>
              </div>
            )}
            {status === "guest" && (
              <Link href="/login" title="Sign in" className="flex h-12 items-center gap-2.5 rounded-full bg-white px-3 text-[15px] font-bold text-black">
                <Icon name="user" className="size-7 shrink-0" />
                <span className={LABEL}>Sign in</span>
              </Link>
            )}
          </div>
        </aside>
      </div>

      {/* On home, main slides back under the rail so the feed centres on the whole viewport. */}
      <main
        className={`min-w-0 flex-1 ${fullBleed ? "md:-ml-[76px]" : ""}`}
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
