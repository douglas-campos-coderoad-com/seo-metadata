import type { ReactNode } from 'react';

interface HeroProps {
  children?: ReactNode;
}

export function Hero({ children }: HeroProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card py-16">
      {/* A slow, subtle swell — minimal ambient motion, not a gradient background. */}
      <div
        aria-hidden
        className="animate-swell pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-ring/10 blur-3xl"
      />

      <div className="relative mx-auto flex flex-col items-center gap-6 px-6 md:px-[8.25rem] text-center">
        <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
          <span className="text-muted-foreground">
            Get found by Search Engines.
          </span>
          <br />
          <span className="text-[3.55rem]">
            Get recommended by AI.
          </span>
        </h1>
        <p className="text-muted-foreground">
          Paste a product listing URL and get an instant SEO score showing what&apos;s costing you search visibility —
          then get an AI-generated suggestion optimized for AI and Search Engines, prove it works by testing whether they
          actually recommend your listing before and after.
        </p>
        {children && <div className="w-full">{children}</div>}
      </div>
    </div>
  );
}
