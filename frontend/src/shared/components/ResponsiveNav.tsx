'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, TrendingUp, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

const NAV_LINKS = [
  { href: '/analyze', label: 'Analyze' },
  { href: '/projects', label: 'Projects' },
];

export function ResponsiveNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="border-b border-border px-4">
      <div className="flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-1.5 font-display text-lg font-bold">
          <TrendingUp className="h-5 w-5 text-ring" />
          <span>Visora Analyzer</span>
        </Link>

        <ul className="hidden items-center gap-1 sm:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Button asChild variant="ghost" size="sm">
                <Link href={link.href}>{link.label}</Link>
              </Button>
            </li>
          ))}
        </ul>

        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {menuOpen && (
        <ul className="flex flex-col gap-1 border-t border-border py-2 sm:hidden">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Button asChild variant="ghost" size="sm" className="w-full justify-start" onClick={() => setMenuOpen(false)}>
                <Link href={link.href}>{link.label}</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
