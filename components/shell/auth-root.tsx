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
import { ShellGate } from "@/components/shell/shell-gate";
import { AuthModalProvider } from "@/lib/auth/auth-modal";
import { NotificationPill } from "@/components/shell/notification-pill";
import { InAppBanner } from "@/components/shell/in-app-banner";
import { UploadDock } from "@/components/create/upload-dock";
import { AppNudges } from "@/components/pwa/app-nudges";
import { InstallNudge } from "@/components/pwa/install-nudge";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { PageWarmer } from "@/components/pwa/page-warmer";
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
                <AuthModalProvider><ShellGate>{children}</ShellGate></AuthModalProvider>
                <Suspense fallback={null}><NotificationPill /></Suspense>
                <Suspense fallback={null}><InAppBanner /></Suspense>
                <Suspense fallback={null}><UploadDock /></Suspense>
                <PwaRegister />
                <PageWarmer />
                <PushSync />
                <Suspense fallback={null}><InstallNudge /></Suspense>
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
