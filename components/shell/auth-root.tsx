import { Suspense } from "react";
import { AuthProvider } from "@/lib/auth/auth-context";
import { resolveInitialAuth } from "@/lib/server/initial-auth";
import { ActivityProvider } from "@/lib/activity/activity-context";
import { NotificationsPanelProvider } from "@/lib/notifications/panel-context";
import { PlaybackProvider } from "@/components/feed/playback-context";
import { MessagesUnreadProvider } from "@/lib/messaging/unread-context";
import { MessagesProvider } from "@/components/messaging/messages-context";
import { ShareProvider } from "@/lib/share/share-context";
import { DialogProvider } from "@/lib/ui/dialog";
import { StoryHostProvider } from "@/lib/stories/story-host";
import { AppShell } from "@/components/shell/app-shell";
import { NotificationPill } from "@/components/shell/notification-pill";
import { InAppBanner } from "@/components/shell/in-app-banner";
import { UploadDock } from "@/components/create/upload-dock";
import { AppNudges } from "@/components/pwa/app-nudges";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { PushSync } from "@/components/pwa/push-sync";

// Reads the session cookie on the server (runtime data), so it must live under a Suspense boundary.
// The layout supplies the splash fallback; once this resolves, the very first real paint already knows who is signed in.
export async function AuthRoot({ children }: { children: React.ReactNode }) {
  const initialAuth = await resolveInitialAuth();
  return (
    <AuthProvider initial={initialAuth}>
      <ActivityProvider>
        <NotificationsPanelProvider>
          <MessagesUnreadProvider>
            <MessagesProvider>
              <PlaybackProvider>
                <DialogProvider>
                <StoryHostProvider>
                <ShareProvider>
                <AppShell>{children}</AppShell>
                <Suspense fallback={null}><NotificationPill /></Suspense>
                <Suspense fallback={null}><InAppBanner /></Suspense>
                <Suspense fallback={null}><UploadDock /></Suspense>
                <PwaRegister />
                <PushSync />
                <Suspense fallback={null}><AppNudges /></Suspense>
                </ShareProvider>
                </StoryHostProvider>
                </DialogProvider>
              </PlaybackProvider>
            </MessagesProvider>
          </MessagesUnreadProvider>
        </NotificationsPanelProvider>
      </ActivityProvider>
    </AuthProvider>
  );
}
