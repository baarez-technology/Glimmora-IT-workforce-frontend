'use client';

import { ChevronLeft, Lock } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { useAuthStore } from '@/lib/auth-store';
import { CURRENT_PHASE, NAVIGATION, isVisibleTo, type NavItem } from '@/lib/navigation';
import { cn } from '@/lib/utils';

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const built = item.phase <= CURRENT_PHASE;
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : item.description}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-sidebar-active/15 font-medium text-white'
          : 'text-sidebar-foreground/85 hover:bg-white/5 hover:text-white',
        !built && 'text-sidebar-muted',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {!built && (
            <span
              className="flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-2xs font-medium text-sidebar-muted"
              title={`Delivered in Phase ${item.phase}`}
            >
              <Lock className="h-2.5 w-2.5" aria-hidden />P{item.phase}
            </span>
          )}
        </>
      )}
      {active && <span className="sr-only">(current)</span>}
    </Link>
  );
}

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const user = useAuthStore((state) => state.user);

  // Items the user cannot act on are hidden to reduce noise. This is not a
  // security boundary — the API enforces every one of these independently.
  const sections = NAVIGATION.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      isVisibleTo(item, { role: user?.role, permissions: user?.permissions }),
    ),
  })).filter((section) => section.items.length > 0);

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        'flex h-full flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-active font-bold text-white">
          G
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold text-white">Glimmora</div>
            <div className="truncate text-2xs text-sidebar-muted">Workforce Intelligence</div>
          </div>
        )}
      </div>

      <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <div className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-wider text-sidebar-muted">
                {section.label}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink key={item.href} item={item} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        className="flex h-11 items-center justify-center border-t border-sidebar-border text-sidebar-muted transition-colors hover:bg-white/5 hover:text-white"
      >
        <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} aria-hidden />
      </button>
    </nav>
  );
}
