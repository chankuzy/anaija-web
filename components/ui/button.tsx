import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost";

export function buttonClass(variant: Variant = "primary", extra = "") {
  const base =
    "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-bold transition-[background-color,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";
  const styles: Record<Variant, string> = {
    primary: "bg-brand text-brand-fg hover:bg-brand-hover",
    outline: "bg-card-elevated text-fg hover:bg-surface-elevated",
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
