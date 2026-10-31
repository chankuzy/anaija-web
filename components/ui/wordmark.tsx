import { Dancing_Script } from "next/font/google";

// Lowercase script wordmark. One weight, latin only, so it stays a single small font file.
const script = Dancing_Script({ subsets: ["latin"], weight: "700", display: "swap" });

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`${script.className} text-[30px] font-bold leading-none tracking-[-0.01em] text-fg ${className}`}>anaija</span>;
}
