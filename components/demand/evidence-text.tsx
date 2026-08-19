'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The source job description, with the span that produced the selected field
 * highlighted.
 *
 * This is the difference between a reviewer verifying an extraction and merely
 * trusting it: they can see the exact words the value came from, in context
 * (AI_ARCHITECTURE.md section 3).
 */
export function EvidenceText({
  text,
  start,
  end,
  className,
}: {
  text: string;
  start?: number | null;
  end?: number | null;
  className?: string;
}) {
  const markRef = React.useRef<HTMLElement>(null);

  const hasSpan =
    typeof start === 'number' &&
    typeof end === 'number' &&
    start >= 0 &&
    end > start &&
    end <= text.length;

  React.useEffect(() => {
    // Guarded: not every environment implements scrollIntoView, and failing to
    // scroll must never break the review screen.
    markRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [hasSpan, start, end]);

  if (!hasSpan) {
    return (
      <pre
        className={cn(
          'scrollbar-thin max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-4 font-sans text-sm leading-relaxed',
          className,
        )}
      >
        {text}
      </pre>
    );
  }

  return (
    <pre
      className={cn(
        'scrollbar-thin max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-4 font-sans text-sm leading-relaxed',
        className,
      )}
    >
      {text.slice(0, start!)}
      <mark
        ref={markRef}
        className="rounded bg-warning/35 px-0.5 py-px font-medium text-foreground ring-1 ring-warning/50"
      >
        {text.slice(start!, end!)}
      </mark>
      {text.slice(end!)}
    </pre>
  );
}
