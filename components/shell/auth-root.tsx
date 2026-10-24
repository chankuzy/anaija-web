import { Suspense } from "react";
import { AuthProvider } from "@/lib/auth/auth-context";
import { resolveInitialAuth } from "@/lib/server/initial-auth";
import { ActivityProvider } from "@/lib/activity/activity-context";
import { NotificationsPanelProvider } from "@/lib/notifications/panel-context";
import { PlaybackProvider } from "@/components/feed/playback-context";
import { MessagesUnreadProvider } from "@/lib/messaging/unread-context";
import { MessagesProvider } from "@/components/messaging/messages-context";
import { ShareProvider } from "@/lib/share/share-context";
import { AppShell } from "@/components/shell/app-shell";
import { NotificationPill } from "@/components/shell/notification-pill";
import { UploadDock } from "@/components/create/upload-dock";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { PushSync } from "@/components/pwa/push-sync";

export async function AuthRoot({ children }: { children: React.ReactNode }) {
  const initialAuth = await resolveInitialAuth();
  return (
    <AuthProvider initial={initialAuth}>
      <ActivityProvider>
        <NotificationsPanelProvider>
          <MessagesUnreadProvider>
            <MessagesProvider>
              <PlaybackProvider>
                <ShareProvider>
                <AppShell>{children}</AppShell>
                <Suspense fallback={null}><NotificationPill /></Suspense>
                <Suspense fallback={null}><UploadDock /></Suspense>
                <PwaRegister />
                <PushSync />
                <Suspense fallback={null}><InstallPrompt /></Suspense>
                </ShareProvider>
              </PlaybackProvider>
            </MessagesProvider>
          </MessagesUnreadProvider>
        </NotificationsPanelProvider>
      </ActivityProvider>
    </AuthProvider>
  );
}
