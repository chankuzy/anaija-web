"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { needsProfileSetup } from "@/lib/auth/guards";
import { useAuth } from "@/lib/auth/auth-context";
import { useActivity } from "@/lib/activity/activity-context";
import { useMessagesUnread } from "@/lib/messaging/unread-context";
import { useTabBadge } from "@/lib/notifications/tab-badge";
import { UnreadBadge } from "@/components/ui/unread-badge";
import { useNotificationsPanel } from "@/lib/notifications/panel-context";
import { mediaUrl } from "@/lib/api/feed";
import { Icon, type IconName } from "@/components/ui/icon";
import { AppLogo } from "@/components/ui/app-logo";
import { Avatar } from "@/components/ui/avatar";
import { NotificationsView } from "@/components/notifications/notifications-view";
import { CreateSheet } from "@/components/create/create-sheet";
import { PublishShare } from "@/components/create/publish-share";

type NavItem = { href: string; label: string; icon: IconName; auth?: boolean; mobile?: "tab" | "create" };

// Mobile tabs: Home, Discover, [Create], Reels, Profile. Messages and Notifications live in the rail on md+ and in the
// Home header on mobile. Guests get sent to sign-in for anything but Home and Reels. Notifications has no page: on md+
// it is a slide-out panel beside the rail, on mobile a full-screen sheet (opened by the bell, any link to /notifications).
const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: "home", mobile: "tab" },
  { href: "/discover", label: "Discover", icon: "search", auth: true, mobile: "tab" },
  { href: "/communities", label: "Communities", icon: "usersGroupRounded", auth: true, mobile: "tab" },
  { href: "/create/new", label: "Create", icon: "plus", auth: true, mobile: "create" },
  { href: "/watch", label: "Media", icon: "clapperboard", mobile: "tab" },
  { href: "/messages", label: "Messages", icon: "message", auth: true },
  { href: "/notifications", label: "Notifications", icon: "bell", auth: true },
  { href: "/me", label: "Profile", icon: "user", auth: true, mobile: "tab" },
];

const SIDE = NAV.filter((n) => n.mobile !== "create");
const CREATE = NAV.find((n) => n.mobile === "create")!;

const ASIDE_BASE =
  "group/side sticky top-0 z-[2] flex h-dvh w-[76px] flex-col justify-between overflow-hidden px-3 py-6 transition-[width,background-color,box-shadow] duration-200 ease-out";
// Expand on hover or keyboard focus only (focus-visible), so a mouse click never leaves the rail stuck open.
const ASIDE_EXPAND =
  "hover:w-[256px] hover:bg-bg/92 hover:shadow-[12px_0_48px_rgba(0,0,0,0.55)] hover:backdrop-blur-xl has-[:focus-visible]:w-[256px] has-[:focus-visible]:bg-bg/92 has-[:focus-visible]:shadow-[12px_0_48px_rgba(0,0,0,0.55)] has-[:focus-visible]:backdrop-blur-xl";
const LABEL_BASE = "whitespace-nowrap opacity-0 transition-opacity duration-150";
const LABEL_SHOW = "group-hover/side:opacity-100 group-has-[:focus-visible]/side:opacity-100";
const ITEM = "flex h-[52px] items-center gap-4 rounded-full px-[10px] text-[15px] transition-colors";
const ACTIVE = "bg-white/8 font-bold text-white";
const IDLE = "font-medium text-white/60 hover:bg-white/6 hover:text-white";

const MD = "(min-width: 768px)";
function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(MD);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(MD).matches,
    () => true,
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <AppShellContent>{children}</AppShellContent>
    </Suspense>
  );
}

export function AppShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, user, signOut } = useAuth();
  const { unseen } = useActivity();
  const { count: msgUnread } = useMessagesUnread();
  const { open: panelOpen, toggle: togglePanel, hide: closePanel } = useNotificationsPanel();
  const desktop = useIsDesktop();
  const [createOpen, setCreateOpen] = useState(false);
  // The unread badge is derived from the live inbox (reading a chat clears it at once), so navigation refetches nothing.
  useTabBadge(msgUnread + unseen);
  useEffect(() => {
    closePanel();
  }, [pathname, closePanel]);

  // Anything in the app (e.g. the Home topbar plus) can ask for the Create sheet.
  useEffect(() => {
    const open = () => setCreateOpen(true);
    window.addEventListener("anaija:create", open);
    return () => window.removeEventListener("anaija:create", open);
  }, []);

  useEffect(() => {
    if (status === "authed" && needsProfileSetup(user) && pathname !== "/setup" && pathname !== "/login") {
      router.replace(pathname === "/" ? "/setup" : `/setup?next=${encodeURIComponent(pathname + window.location.search)}`);
    }
  }, [status, user, pathname, router]);

  if (pathname === "/login" || pathname === "/setup") return <>{children}</>;

  // Segment-exact: "/messages" must not match "/me".
  const matches = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/communities") return matches("/communities") || matches("/c") || matches("/s") || matches("/join");
    if (href === "/me") return matches("/me") || (!!user?.username && matches(`/u/${user.username}`));
    return matches(href);
  };
  const hrefFor = (n: NavItem) =>
    n.auth && status === "guest" ? (n.href === "/notifications" ? "/login" : `/login?next=${encodeURIComponent(n.href)}`) : n.href;
  const fullBleed = pathname === "/" || pathname === "/watch" || pathname.startsWith("/p/");
  // Inside a conversation the thread owns the whole screen: no bottom tabs, and nothing reserves room for them.
  const inChat = /^\/messages\/\d+/.test(pathname);
  const railPanel = panelOpen && desktop;
  const label = `${LABEL_BASE} ${railPanel ? "" : LABEL_SHOW}`;
  const avatar = user ? mediaUrl(user.avatar) : null;
  // Create FAB (mobile): only on tab-root pages whose right edge is free. Home and Media keep it off the action rail.
  const onCommunities = pathname === "/communities";
  const showFab = !inChat && (onCommunities || pathname === "/discover" || pathname === "/me");
  // Signed-in users get the kind picker; guests keep the plain link to sign-in.
  const openCreate = (e: React.MouseEvent) => {
    if (status !== "authed") return;
    e.preventDefault();
    setCreateOpen(true);
  };

  return (
    <div
      className={`flex min-h-dvh w-full ${fullBleed ? "" : "mx-auto max-w-[1440px]"}`}
      style={inChat ? ({ "--nav-h": "0px" } as React.CSSProperties) : undefined}
    >
      {/* Rail (md+): reserves 76px. The aside grows over the page on hover and shrinks back on leave; while the
          notifications panel is open it stays icon-only and the panel slides out beside it. */}
      <div className="relative z-40 hidden w-[76px] shrink-0 md:block">
        {railPanel && (
          <>
            <button type="button" aria-label="Close notifications" onClick={closePanel} className="fixed inset-0 z-[1] cursor-default" />
            <div className="sticky top-0 z-[2] h-0">
              <div
                role="dialog"
                aria-label="Notifications"
                className="notif-panel absolute left-full top-0 h-dvh w-[400px] max-w-[calc(100vw-76px)] overflow-hidden rounded-r-[28px] bg-bg shadow-[12px_0_48px_rgba(0,0,0,0.55)]"
              >
                <NotificationsView onClose={closePanel} />
              </div>
            </div>
          </>
        )}

        <aside className={`${ASIDE_BASE} ${railPanel ? "bg-bg" : ASIDE_EXPAND}`}>
          <div className="flex flex-col">
            <Link href="/" aria-label="Anaija home" className="mb-8 flex h-11 items-center px-[9px]">
              <span className={railPanel ? "" : "group-hover/side:hidden group-has-[:focus-visible]/side:hidden"}>
                <AppLogo size={34} showWordmark={false} />
              </span>
              {!railPanel && (
                <span className="hidden group-hover/side:inline group-has-[:focus-visible]/side:inline">
                  <AppLogo size={34} />
                </span>
              )}
            </Link>

            <nav className="flex flex-col gap-1.5">
              {SIDE.map((n) => {
                const isBell = n.href === "/notifications";
                const count = isBell ? unseen : n.href === "/messages" ? msgUnread : 0;
                const what = isBell ? "new notifications" : "unread chats";
                const active = railPanel ? isBell : isActive(n.href);
                const cls = `${ITEM} ${active ? ACTIVE : IDLE}`;
                const inner = (
                  <>
                    <span className="relative shrink-0">
                      <Icon name={n.icon} filled={active} className="size-8" />
                      {count > 0 && (
                        <span
                          className={`absolute -right-1.5 -top-1 origin-center transition-transform duration-200 ${
                            railPanel ? "" : "group-hover/side:scale-0 group-has-[:focus-visible]/side:scale-0"
                          }`}
                        >
                          <UnreadBadge count={count} label={what} />
                        </span>
                      )}
                    </span>
                    <span className={label}>{n.label}</span>
                    {count > 0 && (
                      <span className={`ml-auto pr-1 ${label}`}>
                        <UnreadBadge count={count} label={what} flat />
                      </span>
                    )}
                  </>
                );
                if (isBell && status === "authed") {
                  return (
                    <button
                      key={n.href}
                      type="button"
                      title={n.label}
                      aria-haspopup="dialog"
                      aria-expanded={railPanel}
                      onClick={togglePanel}
                      className={`${cls} w-full text-left`}
                    >
                      {inner}
                    </button>
                  );
                }
                return (
                  <Link key={n.href} href={hrefFor(n)} title={n.label} aria-current={active ? "page" : undefined} className={cls}>
                    {inner}
                  </Link>
                );
              })}
            </nav>

            <Link
              href={hrefFor(CREATE)}
              title="Create"
              onClick={openCreate}
              className={`${ITEM} mt-4 ${IDLE}`}
            >
              <Icon name="plus" className="size-8 shrink-0" />
              <span className={label}>Create</span>
            </Link>
          </div>

          <div className="flex flex-col gap-1.5">
            {status === "authed" && (
              <div className="flex flex-col gap-1.5 pt-4">
                <Link href="/me" title="Profile" className="flex h-[52px] items-center gap-3 rounded-full px-[7px] transition-colors hover:bg-white/6">
                  <Avatar url={avatar} name={user?.name ?? user?.username} size={38} />
                  <span className={`min-w-0 ${label}`}>
                    <span className="block truncate text-body font-semibold text-white">{user?.name ?? ""}</span>
                    <span className="block truncate text-supporting text-white/50">{user?.username ? `@${user.username}` : ""}</span>
                  </span>
                </Link>
                <Link href="/settings" title="Settings" className={`${ITEM} ${matches("/settings") && !railPanel ? ACTIVE : IDLE}`}>
                  <Icon name="settings" className="size-8 shrink-0" />
                  <span className={label}>Settings</span>
                </Link>
                <button type="button" onClick={() => void signOut()} title="Sign out" className={`${ITEM} w-full ${IDLE}`}>
                  <Icon name="logout" className="size-8 shrink-0" />
                  <span className={label}>Sign out</span>
                </button>
              </div>
            )}
            {status === "guest" && (
              <Link href={`/login?next=${encodeURIComponent(pathname)}`} title="Sign in" className="flex h-12 items-center gap-2.5 rounded-full bg-brand px-3 text-[15px] font-extrabold text-brand-fg">
                <Icon name="user" className="size-7 shrink-0" />
                <span className={label}>Sign in</span>
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
        className={`fixed inset-x-0 bottom-0 z-40 ${inChat ? "hidden" : "flex"} bg-[rgba(9,9,11,0.9)] md:hidden`}
        style={{ height: "calc(var(--nav-h) + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV.filter((n) => n.mobile === "tab").map((n) => {
          const active = isActive(n.href);
          return (
            <Link
              key={n.href}
              href={hrefFor(n)}
              aria-label={n.label}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-1 items-center justify-center transition-transform active:scale-95 ${
                active ? "text-white" : "text-white/60"
              }`}
            >
              <Icon name={n.icon} filled={active} className="size-[30px]" />
              {active && <span aria-hidden="true" className="absolute bottom-1.5 size-1 rounded-full bg-white" />}
            </Link>
          );
        })}
      </nav>

      {showFab && !panelOpen && (
        <Link
          key={pathname}
          href={hrefFor(onCommunities ? { ...CREATE, href: "/communities/new" } : CREATE)}
          aria-label={onCommunities ? "New community" : "Create"}
          onClick={onCommunities ? undefined : openCreate}
          className="fab-in fixed right-4 z-30 grid size-[58px] place-items-center rounded-full text-white ring-1 ring-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-10px_18px_rgba(0,0,0,0.5),0_20px_38px_-10px_rgba(0,0,0,0.95),0_4px_10px_rgba(0,0,0,0.6)] transition-transform duration-150 active:scale-90 md:hidden"
          style={{
            bottom: "calc(var(--nav-h) + env(safe-area-inset-bottom) + 16px)",
            background: "linear-gradient(145deg, #2d2d33 0%, #18181b 55%, #0c0c0e 100%)",
          }}
        >
          <Icon name="plus" weight="strong" className="size-7" />
        </Link>
      )}

      {createOpen && <CreateSheet onClose={() => setCreateOpen(false)} />}
      <PublishShare />

      {/* Mobile: the same panel as a full-screen sheet. */}
      {panelOpen && !desktop && (
        <div role="dialog" aria-label="Notifications" className="fixed inset-0 z-50 bg-bg">
          <NotificationsView onClose={closePanel} />
        </div>
      )}
    </div>
  );
}
