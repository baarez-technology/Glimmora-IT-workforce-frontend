'use client';

import { JobFeed } from '@/components/jobfeed/job-feed';

/** The roles this individual kept. */
export default function SavedJobsPage() {
  return <JobFeed savedOnly />;
}
