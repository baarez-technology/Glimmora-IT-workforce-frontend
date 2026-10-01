'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type {
  AddJobInput,
  AlertConnection,
  AlertIngestResult,
  JobFeedCounts,
  JobFeedItem,
  JobFeedPage,
  JobFeedQuery,
  RegisterInput,
  RegisteredUser,
  SearchAvailability,
  SearchRequest,
  SearchRun,
  SearchStarted,
} from '@/types/jobfeed';

export const jobFeedKeys = {
  all: ['job-feed'] as const,
  list: (query: JobFeedQuery) => ['job-feed', 'list', query] as const,
  counts: () => ['job-feed', 'counts'] as const,
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

/**
 * Create an individual account.
 *
 * Unauthenticated by design — this is how somebody who has no account gets
 * one. The role is decided by the server and is not sent.
 */
export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterInput) => api.post<RegisteredUser>('/auth/register', input),
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
export function useJobFeedCounts() {
  return useQuery({
    queryKey: jobFeedKeys.counts(),
    queryFn: () => api.get<JobFeedCounts>('/job-feed/counts'),
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

export function useAlertConnection() {
  return useQuery({
    queryKey: ['job-feed', 'alerts', 'connection'],
    queryFn: () => api.get<AlertConnection>('/job-feed/alerts/connection'),
  });
}

/**
 * Import an alert by pasting it.
 *
 * Real on its own, and it means the whole path can be exercised before any
 * DNS exists.
 */
export function usePasteAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; subject?: string; sender?: string }) =>
      api.post<AlertIngestResult>('/job-feed/alerts/paste', input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: jobFeedKeys.all }),
  });
}
