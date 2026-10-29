export function TypingBubble({ label }: { label?: string }) {
  return (
    <div className="mb-2 ml-9 flex flex-col items-start gap-1" role="status" aria-label={label ?? "Typing"}>
      {label && <span className="px-1 text-supporting font-semibold text-muted">{label}</span>}
      <span className="flex items-center gap-1 rounded-[18px] rounded-bl-[6px] bg-card-elevated px-3.5 py-3">
        {[0, 150, 300].map((d) => (
          <span key={d} className="size-[7px] animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d}ms`, animationDuration: "900ms" }} />
        ))}
      </span>
    </div>
  );
}
