'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type {
  AddJobInput,
  JobFeedCounts,
  JobFeedItem,
  JobFeedPage,
  JobFeedQuery,
  Colleague,
  ShareInput,
  ShareResult,
  SearchAvailability,
  SearchRequest,
  SearchRun,
  SearchStarted,
} from '@/types/jobfeed';

export const jobFeedKeys = {
  all: ['job-feed'] as const,
  list: (query: JobFeedQuery) => ['job-feed', 'list', query] as const,
  counts: (scope: { saved_only?: boolean; shared_only?: boolean } = {}) =>
    ['job-feed', 'counts', scope] as const,
  colleagues: () => ['job-feed', 'colleagues'] as const,
};

function clean<T extends object>(query: T): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== '' && value !== false),
  ) as Record<string, string | number | boolean>;
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: jobFeedKeys.all });
}

/** Who this person can pass a job to. Names and roles only, not a directory. */
export function useColleagues(enabled = true) {
  return useQuery({
    queryKey: jobFeedKeys.colleagues(),
    queryFn: () => api.get<Colleague[]>('/job-feed/colleagues'),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Pass one of your jobs to colleagues. */
export function useShareJob(itemId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: ShareInput) =>
      api.post<ShareResult>(`/job-feed/${itemId}/share`, input),
    onSuccess: invalidate,
  });
}

/**
 * Mark handovers as seen.
 *
 * Deliberately separate from marking the jobs read: clearing the badge should
 * not pretend you have read every job somebody sent you.
 */
export function useAcknowledgeShares() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => api.post<{ acknowledged: number }>('/job-feed/shares/acknowledge', {}),
    onSuccess: invalidate,
  });
}

export function useJobFeed(query: JobFeedQuery = {}) {
  return useQuery({
    queryKey: jobFeedKeys.list(query),
    queryFn: () => api.get<JobFeedPage>('/job-feed', { query: clean(query) }),
    placeholderData: (previous) => previous,
  });
}

/**
 * Counts for the filter chips.
 *
 * Fetched separately rather than derived from the current page, so a chip
 * never contradicts the list it filters — a page of 50 cannot tell you how
 * many remote roles exist in a feed of 400.
 */
/**
 * Counts for the filter chips.
 *
 * Scoped to the view the chips sit above, so "All 2" can never appear over an
 * empty Saved list.
 */
export function useJobFeedCounts(scope: { saved_only?: boolean; shared_only?: boolean } = {}) {
  return useQuery({
    queryKey: jobFeedKeys.counts(scope),
    queryFn: () => api.get<JobFeedCounts>('/job-feed/counts', { query: clean(scope) }),
  });
}

/** Remove a job from your own feed. The posting survives for everyone else. */
export function useDeleteJob() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (itemId: string) => api.delete<void>(`/job-feed/${itemId}`),
    onSuccess: invalidate,
  });
}

export function useSetItemState(itemId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { is_read?: boolean; is_saved?: boolean }) =>
      api.patch<JobFeedItem>(`/job-feed/${itemId}`, input),
    onSuccess: invalidate,
  });
}

export function useMarkAllJobsRead() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => api.post<{ marked: number }>('/job-feed/read-all'),
    onSuccess: invalidate,
  });
}

/**
 * Add a job by hand.
 *
 * A real feature on its own — somebody finds a role elsewhere and wants it in
 * one place — and the same seam the email capture and search providers will
 * deliver through, so they inherit deduplication.
 */
export function useAddJob() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: AddJobInput) => api.post<JobFeedItem>('/job-feed/jobs', input),
    onSuccess: invalidate,
  });
}

/* ------------------------------------------------------------ job search */

/**
 * Whether search is configured at all.
 *
 * With no provider the screen hides rather than offering a box that can never
 * return anything.
 */
export function useSearchAvailability() {
  return useQuery({
    queryKey: ['job-search', 'available'],
    queryFn: () => api.get<SearchAvailability>('/job-feed/search/available'),
    staleTime: 60 * 60_000,
  });
}

export function useStartSearch() {
  return useMutation({
    mutationFn: (input: SearchRequest) => api.post<SearchStarted>('/job-feed/search', input),
  });
}

/**
 * Poll a running search.
 *
 * A provider run takes about thirty seconds, so the request that starts it
 * returns a handle and this collects the answer. Polling stops the moment the
 * run leaves RUNNING.
 */
export function useSearchRun(searchId: string | null) {
  return useQuery({
    queryKey: ['job-search', 'run', searchId],
    queryFn: () => api.get<SearchRun>(`/job-feed/search/${searchId}`),
    enabled: Boolean(searchId),
    refetchInterval: (query) =>
      query.state.data?.status === 'RUNNING' ? 4_000 : false,
  });
}

/* ---------------------------------------------------------- job alerts */

