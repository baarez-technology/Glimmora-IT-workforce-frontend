'use client';

import { Bookmark, Inbox, Search, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { useAcknowledgeShares, useJobFeedCounts } from '@/hooks/use-jobfeed';
import { cn } from '@/lib/utils';

/**
 * One sidebar entry, four sections.
 *
 * These were four nav items. They are one now, because they are four views of
 * the same work rather than four places to go — and a sourcing tool that eats
 * four slots in a sidebar shared with the whole business is out of proportion
 * to how often it is opened.
 *
 * The routes stayed as routes rather than becoming client-side tab state, so a
 * section is still linkable, still has its own history entry, and still
 * survives a refresh.
 */
const TABS = [
  {
    href: '/jobs/feed',
    label: 'My Feed',
    icon: Inbox,
    hint: 'Jobs that reached you',
  },
  {
    href: '/jobs/search',
    label: 'Search',
    icon: Search,
    hint: 'The open market',
  },
  {
    href: '/jobs/shared',
    label: 'Shared with me',
    icon: Users,
    hint: 'Jobs Sales and Resourcing passed across',
  },
  {
    href: '/jobs/saved',
    label: 'Saved',
    icon: Bookmark,
    hint: 'The roles you kept',
  },
] as const;

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const counts = useJobFeedCounts();
  const acknowledge = useAcknowledgeShares();

  const unreadShares = counts.data?.shared_unack ?? 0;
  const onShared = pathname.startsWith('/jobs/shared');

  // Opening the handover tab is what "I have seen these" means. Doing it here
  // rather than inside the feed component keeps the badge and the thing that
  // clears it in one place.
  const acknowledgeRef = React.useRef(acknowledge);
  acknowledgeRef.current = acknowledge;
  React.useEffect(() => {
    if (onShared && unreadShares > 0 && !acknowledgeRef.current.isPending) {
      acknowledgeRef.current.mutate();
    }
  }, [onShared, unreadShares]);

  return (
    <div className="space-y-6">
      <nav aria-label="Job offers sections" className="border-b">
        <ul className="-mb-px flex flex-wrap gap-1">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  title={tab.hint}
                  className={cn(
                    'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors',
                    active
                      ? 'border-primary font-medium text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {tab.label}
                  {tab.href === '/jobs/shared' && unreadShares > 0 ? (
                    <span
                      className="ml-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-medium leading-none text-primary-foreground"
                      aria-label={`${unreadShares} shared with you`}
                    >
                      {unreadShares}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {children}
    </div>
  );
}
