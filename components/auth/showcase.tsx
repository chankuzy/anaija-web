/* eslint-disable @next/next/no-img-element */

function Screen({ src }: { src: string }) {
  return <img src={src} alt="" draggable={false} className="h-full w-full select-none object-cover object-top" />;
}

function Phone({ className, delay, children }: { className: string; delay: number; children: React.ReactNode }) {
  return (
    <div className={`login-rise absolute ${className}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="login-float" style={{ animationDelay: `${delay * 3}ms` }}>
        <div className="relative h-[440px] w-[216px] overflow-hidden rounded-[34px] bg-black shadow-[0_30px_60px_rgba(0,0,0,0.6)]">
          <span className="absolute left-1/2 top-2 z-10 h-[10px] w-[54px] -translate-x-1/2 rounded-full bg-black" />
          {children}
        </div>
      </div>
    </div>
  );
}

/** Three fanned phones using real Anaija screens. Decorative only; the container is aria-hidden. */
export function Showcase() {
  return (
    <div aria-hidden className="relative mx-auto h-[330px] w-full md:h-[520px] md:w-[520px]">
      <div className="absolute left-1/2 top-0 h-[520px] w-[520px] origin-top -translate-x-1/2 scale-[0.62] md:scale-100">
        <div
          className="login-glow absolute left-1/2 top-1/2 size-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(255,216,77,0.2), transparent)" }}
        />
        <Phone className="left-0 top-[70px] -rotate-[9deg] scale-[0.92]" delay={250}>
          <Screen src="/brand/auth/profile.jpg" />
        </Phone>
        <Phone className="right-0 top-[70px] rotate-[9deg] scale-[0.92]" delay={400}>
          <Screen src="/brand/auth/reel.jpg" />
        </Phone>
        <Phone className="left-[152px] top-0 z-10" delay={0}>
          <Screen src="/brand/auth/feed.jpg" />
        </Phone>
      </div>
    </div>
  );
}
