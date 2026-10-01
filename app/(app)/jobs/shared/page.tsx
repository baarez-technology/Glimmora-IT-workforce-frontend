'use client';

import { JobFeed } from '@/components/jobfeed/job-feed';

/** Jobs colleagues passed across — the Sales/Resourcing handover inbox. */
export default function SharedJobsPage() {
  return <JobFeed sharedOnly />;
}
