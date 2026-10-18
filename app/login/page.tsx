import type { Metadata } from "next";
import { GoogleLogin } from "@/components/auth/google-login";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return <GoogleLogin />;
}
