import { redirect } from 'next/navigation';

/** The sidebar points at /jobs; the feed is where it lands. */
export default function JobsIndexPage() {
  redirect('/jobs/feed');
}
