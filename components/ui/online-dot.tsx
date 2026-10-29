export function OnlineDot({ size = 12, className = "" }: { size?: number; className?: string }) {
  return <span role="img" aria-label="Online" className={`rounded-full bg-[#22c55e] ring-[2.5px] ring-bg ${className}`} style={{ width: size, height: size }} />;
}
