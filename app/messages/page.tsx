import type { Metadata } from "next";

export const metadata: Metadata = { title: "Messages" };

// Phones show the inbox pane (from the layout); this placeholder fills the right pane on larger screens.
export default function MessagesIndexPage() {
  return (
    <div className="grid flex-1 place-items-center px-6 text-center">
      <div>
        <p className="text-[17px] font-bold text-fg">Your messages</p>
        <p className="mt-1.5 text-secondary text-muted">Pick a conversation or start a new one.</p>
      </div>
    </div>
  );
}
