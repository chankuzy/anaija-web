"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";

// Same pattern the backend enforces in otp-request / otp-verify.
const PHONE_RE = /^(\+?234|0)[789][01]\d{8}$/;

export function PhoneLogin() {
  const router = useRouter();
  const { status, refresh } = useAuth();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authed") router.replace("/");
  }, [status, router]);

  const fail = (e: unknown) =>
    setError(e instanceof ApiError ? e.message : "Something went wrong.");

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    const p = phone.replace(/\s+/g, "");
    if (!PHONE_RE.test(p)) {
      setError("Please enter a valid Nigerian phone number.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await authApi.requestOtp(p);
      setPhone(p);
      setStep("code");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await authApi.verifyOtp(phone, code);
      await refresh(); // flips status to "authed"; the effect above redirects
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <h1 className="text-4xl font-bold tracking-tight">Anaija</h1>
        <p className="mt-1 text-muted">Hustle. Flex. Earn.</p>

        {step === "phone" ? (
          <form onSubmit={sendCode} className="mt-10 flex flex-col gap-4">
            <input
              className={inputClass}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="Phone number, e.g. 0801 234 5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Button type="submit" disabled={busy} className="h-14 w-full">
              {busy ? "Sending…" : "Send code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-10 flex flex-col gap-4">
            <p className="text-sm text-muted">Enter the 6-digit code sent to {phone}.</p>
            <input
              className={`${inputClass} tracking-[0.5em]`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="······"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <Button type="submit" disabled={busy} className="h-14 w-full">
              {busy ? "Verifying…" : "Verify"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(null);
              }}
            >
              Use a different number
            </Button>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
