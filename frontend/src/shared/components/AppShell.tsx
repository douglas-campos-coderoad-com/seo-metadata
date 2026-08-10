import type { ReactNode } from 'react';
import { ResponsiveNav } from './ResponsiveNav';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <ResponsiveNav />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
