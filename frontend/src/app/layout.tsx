import type { Metadata } from 'next';
import { Hanken_Grotesk, Space_Mono } from 'next/font/google';
import { AppShell } from '@/shared/components/AppShell';
import '@/styles/globals.css';

// Dawn Patrol type system: Hanken Grotesk (body) + Space Mono (data/metrics) are
// self-hosted via next/font. Clash Display (headings) isn't on Google Fonts, so it's
// loaded from Fontshare via a <link> below and referenced as a plain CSS var.
const hankenGrotesk = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-body' });
const spaceMono = Space_Mono({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-data' });

export const metadata: Metadata = {
  title: 'Visora Analyzer',
  description: 'Analyze any URL for SEO issues, get a 0-100 score, and copy-paste ready fixes.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${hankenGrotesk.variable} ${spaceMono.variable}`}>
      <head>
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-display@400,600,700&display=swap" />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
