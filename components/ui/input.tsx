import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * `suppressHydrationWarning` is here for browser extensions, not for our own
 * bugs.
 *
 * Password managers and autofill extensions (LastPass, Dashlane, 1Password and
 * friends) stamp attributes such as `fdprocessedid` onto every form control
 * they touch, in the window between the server HTML arriving and React
 * hydrating. React then reports a mismatch the developer cannot fix, on a page
 * that is working perfectly.
 *
 * The flag is one level deep -- it covers this element's own attributes and
 * nothing inside it -- so a real mismatch anywhere else still warns. The narrow
 * cost is that a genuine attribute difference on this control would also be
 * silenced; keep values out of render-time `Date.now()` and the like, and that
 * case does not arise.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/30',
        className,
      )}
      suppressHydrationWarning
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
