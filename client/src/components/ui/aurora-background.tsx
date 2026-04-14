'use client';

import { cn } from '@/lib/utils';

interface AuroraBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export default function AuroraBackground({ children, className }: AuroraBackgroundProps) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Aurora orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="animate-aurora-1 absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }}
        />
        <div
          className="animate-aurora-2 absolute -top-20 -right-40 h-[600px] w-[600px] rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }}
        />
        <div
          className="animate-aurora-3 absolute -bottom-40 left-1/3 h-[500px] w-[500px] rounded-full opacity-[0.06]"
          style={{ background: 'radial-gradient(circle, #fb923c 0%, transparent 70%)' }}
        />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
