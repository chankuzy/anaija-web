export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-[family-name:var(--font-manrope)] text-[22px] font-extrabold leading-none tracking-[-0.03em] text-fg ${className}`}>
      Anaija<span style={{ color: "var(--pub-yellow, #f6c300)" }}>.</span>
    </span>
  );
}
