'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Mountain, LayoutDashboard, Route, Play, Compass } from 'lucide-react';

const LINKS = [
  { href: '/', label: 'Analyze', icon: Compass },
  { href: '/program', label: 'Program', icon: Route },
  { href: '/onboard', label: 'Onboard', icon: Play },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="bg-glass border-b border-white/[0.06] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 flex items-center h-14 gap-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <Mountain className="w-5 h-5 text-sherpa-500 transition-transform group-hover:scale-110" />
          <span className="text-lg font-bold tracking-tight text-gradient-sherpa">
            Sherpa
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'text-sherpa-400 bg-sherpa-500/10'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {active && (
                  <span className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-sherpa-500" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
