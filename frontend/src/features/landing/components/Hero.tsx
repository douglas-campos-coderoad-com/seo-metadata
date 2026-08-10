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
        className="animate-swell pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl"
      />

      <div className="relative mx-auto flex max-w-xl flex-col items-center gap-6 px-4 text-center">
        <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
          Find and fix your SEO issues in minutes
        </h1>
        <p className="text-muted-foreground">
          Paste a URL and get an instant SEO score, color-coded findings across meta tags, content, and HTML
          structure, and ready-to-copy fixes.
        </p>
        {children && <div className="w-full">{children}</div>}
      </div>
    </div>
  );
}
