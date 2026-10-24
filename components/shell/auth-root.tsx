import { Suspense } from "react";
import { AuthProvider } from "@/lib/auth/auth-context";
import { resolveInitialAuth } from "@/lib/server/initial-auth";
import { ActivityProvider } from "@/lib/activity/activity-context";
import { NotificationsPanelProvider } from "@/lib/notifications/panel-context";
import { PlaybackProvider } from "@/components/feed/playback-context";
import { MessagesUnreadProvider } from "@/lib/messaging/unread-context";
import { AppShell } from "@/components/shell/app-shell";
import { NotificationPill } from "@/components/shell/notification-pill";
import { UploadDock } from "@/components/create/upload-dock";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { PwaRegister } from "@/components/pwa/pwa-register";

// Reads the session cookie on the server (runtime data), so it must live under a Suspense boundary.
// The layout supplies the splash fallback; once this resolves, the very first real paint already knows who is signed in.
export async function AuthRoot({ children }: { children: React.ReactNode }) {
  const initialAuth = await resolveInitialAuth();
  return (
    <AuthProvider initial={initialAuth}>
      <ActivityProvider>
        <NotificationsPanelProvider>
          <MessagesUnreadProvider>
            <PlaybackProvider>
              <AppShell>{children}</AppShell>
              <Suspense fallback={null}><NotificationPill /></Suspense>
              <Suspense fallback={null}><UploadDock /></Suspense>
              <PwaRegister />
              <Suspense fallback={null}><InstallPrompt /></Suspense>
            </PlaybackProvider>
          </MessagesUnreadProvider>
        </NotificationsPanelProvider>
      </ActivityProvider>
    </AuthProvider>
  );
}
