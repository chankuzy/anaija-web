import { MessagesShell } from "@/components/messaging/messages-shell";

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <MessagesShell>{children}</MessagesShell>;
}
