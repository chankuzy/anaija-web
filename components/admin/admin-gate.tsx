import { notFound } from "next/navigation";
import { callFunction } from "@/lib/server/upstream";
import { readToken } from "@/lib/server/session";
import { StaffProvider, type StaffMe } from "./staff-context";

// Reads the session cookie (runtime data), so the layout must mount this under Suspense.
// Anyone who is not active platform staff gets the normal 404 page, never a 403.
// The reason for a 404 is logged on the server only (never sent to the browser).
export async function AdminGate({ children }: { children: React.ReactNode }) {
  const token = await readToken();
  if (!token) {
    console.warn("[admin] 404: no session cookie on this request");
    notFound();
  }

  let res: Response;
  try {
    res = await callFunction("platform/me", { token });
  } catch (e) {
    console.error("[admin] platform/me unreachable", e);
    throw new Error("Platform service is unreachable.");
  }
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    console.warn(`[admin] 404: platform/me answered ${res.status}`);
    notFound();
  }
  if (!res.ok) {
    console.error(`[admin] platform/me answered ${res.status}`);
    throw new Error(`Platform service error (${res.status}).`);
  }

  const me = (await res.json()) as StaffMe;
  return (
    <StaffProvider me={me}>
      <div className="min-h-dvh bg-bg">{children}</div>
    </StaffProvider>
  );
}
