import type { Metadata } from "next";
import { PhoneLogin } from "@/components/auth/phone-login";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return <PhoneLogin />;
}
