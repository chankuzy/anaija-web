// Mirrors shared/widgets/app_logo.dart (jade rounded square "A" + lowercase wordmark).
export function AppLogo({ size = 32, showWordmark = true }: { size?: number; showWordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="grid place-items-center bg-accent font-bold text-black"
        style={{ width: size, height: size, borderRadius: size * 0.28, fontSize: size * 0.5, letterSpacing: "-0.04em" }}
      >
        A
      </span>
      {showWordmark && (
        <span className="font-bold text-fg" style={{ fontSize: size * 0.5, letterSpacing: "-0.02em" }}>
          anaija
        </span>
      )}
    </span>
  );
}
