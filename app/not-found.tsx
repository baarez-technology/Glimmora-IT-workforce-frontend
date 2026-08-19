import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-10 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">That page does not exist</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The address may be mistyped, or the screen may belong to a later build phase.
      </p>
      <Button asChild>
        <Link href="/system">Go to system status</Link>
      </Button>
    </div>
  );
}
