import { redirect } from 'next/navigation';

export default function RootPage() {
  // Phase 11 delivers the role-aware dashboard; until then the system status
  // page is the platform's only complete screen, so it is the landing page.
  redirect('/system');
}
