import type { Metadata, Viewport } from 'next';

import { Providers } from '@/components/providers';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Glimmora Workforce Intelligence',
    template: '%s · Glimmora Workforce Intelligence',
  },
  description:
    'Internal IT outsourcing demand-to-deployment intelligence platform for Glimmora.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

/**
 * Both <html> and <body> suppress hydration warnings, and both are needed.
 *
 * `suppressHydrationWarning` only covers the element's own attributes and text
 * — it does not extend to children — so the one on <html> does nothing for
 * <body>. Browser extensions routinely stamp attributes onto <body> between the
 * server HTML arriving and React hydrating (ColorZilla adds
 * `cz-shortcut-listen`, Grammarly adds `data-gr-ext-installed`), which React
 * then reports as a mismatch the developer cannot fix.
 *
 * This is narrow: a real mismatch anywhere inside the app still warns normally.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
