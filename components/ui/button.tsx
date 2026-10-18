import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost";

export function buttonClass(variant: Variant = "primary", extra = "") {
  const base =
    "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50";
  const styles: Record<Variant, string> = {
    primary: "bg-accent text-white hover:bg-accent/90",
    outline: "border border-line text-fg hover:bg-card",
    ghost: "text-fg hover:bg-card",
  };
  return `${base} ${styles[variant]} ${extra}`.trim();
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function LinkButton({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}
