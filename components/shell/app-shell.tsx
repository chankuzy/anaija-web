"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { Icon, type IconName } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/button";

type NavItem = { href: string; label: string; icon: IconName; auth?: boolean; mobile?: boolean };

// PROVISIONAL: confirm against main_shell.dart / tab_provider.dart before treating as final.
const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: "home", mobile: true },
  { href: "/discover", label: "Discover", icon: "compass", mobile: true },
  { href: "/marketplace", label: "Marketplace", icon: "bag" },
  { href: "/create", label: "Create", icon: "plus", auth: true, mobile: true },
  { href: "/messages", label: "Inbox", icon: "message", auth: true, mobile: true },
  { href: "/notifications", label: "Activity", icon: "bell", auth: true },
  { href: "/me", label: "Profile", icon: "user", auth: true, mobile: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { status, user, signOut } = useAuth();

  if (pathname === "/login") return <>{children}</>;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const hrefFor = (n: NavItem) => (n.auth && status === "guest" ? "/login" : n.href);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1440px]">
      {/* Tablet rail (md) / desktop sidebar (lg) */}
      <aside className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col justify-between border-r border-line px-3 py-5 md:flex lg:w-[248px] lg:px-4">
        <div className="flex flex-col gap-1">
          {/* Placeholder wordmark: swap for the real logo asset from the Flutter project. */}
          <Link href="/" className="mb-4 px-3.5 text-xl font-bold tracking-tight">
            <span className="lg:hidden">A</span>
            <span className="hidden lg:inline">Anaija</span>
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
              <Icon name={n.icon} />
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

      <main className="min-w-0 flex-1 pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>

      {/* Mobile bottom tabs */}
      <nav className="glass fixed inset-x-0 bottom-0 z-40 flex pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.filter((n) => n.mobile).map((n) => (
          <Link
            key={n.href}
            href={hrefFor(n)}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold ${
              isActive(n.href) ? "text-fg" : "text-muted"
            }`}
          >
            <Icon name={n.icon} className={n.icon === "plus" ? "size-6 text-accent" : "size-6"} />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
