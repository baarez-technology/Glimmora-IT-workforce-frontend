'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type {
  BenchRadar,
  Match,
  MatchBand,
  MatchRun,
  ReverseRun,
  ScoringConfigKind,
  ScoringConfiguration,
  SweepResult,
} from '@/types/matching';

export const matchingKeys = {
  all: ['matching'] as const,
  run: (requirementId: string, filters: MatchFilters) =>
    ['matching', requirementId, filters] as const,
  detail: (requirementId: string, resourceId: string) =>
    ['matching', requirementId, 'resource', resourceId] as const,
  configurations: (kind?: ScoringConfigKind) => ['scoring', 'configurations', kind ?? 'all'] as const,
};

export interface MatchFilters {
  band?: MatchBand | '';
  min_score?: number | '';
}

function clean<T extends object>(query: T): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== ''),
  ) as Record<string, string | number | boolean>;
}

/**
 * The stored match snapshot for a requirement.
 *
 * Matching is not recomputed on read (AD-4): this returns whatever the last
 * explicit run produced, along with when it ran, so the screen can say how old
 * the numbers are instead of implying they are live.
 */
export function useMatches(requirementId: string | undefined, filters: MatchFilters = {}) {
  return useQuery({
    queryKey: matchingKeys.run(requirementId ?? '', filters),
    queryFn: () =>
      api.get<MatchRun>(`/matching/requirements/${requirementId}`, { query: clean(filters) }),
    enabled: Boolean(requirementId),
    placeholderData: (previous) => previous,
  });
}

export function useMatch(requirementId: string | undefined, resourceId: string | undefined) {
  return useQuery({
    queryKey: matchingKeys.detail(requirementId ?? '', resourceId ?? ''),
    queryFn: () =>
      api.get<Match>(`/matching/requirements/${requirementId}/resources/${resourceId}`),
    enabled: Boolean(requirementId && resourceId),
  });
}

/** Recompute. Explicit and audited — never a side effect of opening a screen. */
export function useRunMatching(requirementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (limit?: number) =>
      api.post<MatchRun>(`/matching/requirements/${requirementId}/run`, undefined, {
        query: { limit: limit ?? 25 },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: matchingKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export function useScoringConfigurations(kind?: ScoringConfigKind) {
  return useQuery({
    queryKey: matchingKeys.configurations(kind),
    queryFn: () =>
      api.get<ScoringConfiguration[]>('/scoring/configurations', {
        query: kind ? { kind } : undefined,
      }),
  });
}

/* ------------------------------------------------- reverse matching (Phase 8) */

export const reverseKeys = {
  all: ['reverse-matching'] as const,
  forResource: (id: string) => ['reverse-matching', id] as const,
  benchRadar: (days: number) => ['reverse-matching', 'bench-radar', days] as const,
};

/**
 * Stored next-assignment options for one consultant.
 *
 * Like forward matching, this reads a snapshot — opening the screen never
 * recomputes, so the UI can honestly say how old the ranking is.
 */
export function useReverseMatches(resourceId: string | undefined) {
  return useQuery({
    queryKey: reverseKeys.forResource(resourceId ?? ''),
    queryFn: () => api.get<ReverseRun>(`/reverse-matching/resources/${resourceId}`),
    enabled: Boolean(resourceId),
    placeholderData: (previous) => previous,
  });
}

export function useRunReverseMatching(resourceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (limit?: number) =>
      api.post<ReverseRun>(`/reverse-matching/resources/${resourceId}/run`, undefined, {
        query: { limit: limit ?? 10 },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reverseKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

/**
 * Unbilled capacity, and who has nowhere identified to go.
 *
 * Refetched periodically: bench cost accrues daily, so a stale board
 * understates the problem it exists to surface.
 */
export function useBenchRadar(daysAhead = 90) {
  return useQuery({
    queryKey: reverseKeys.benchRadar(daysAhead),
    queryFn: () => api.get<BenchRadar>('/reverse-matching/bench-radar', {
      query: { days_ahead: daysAhead },
    }),
    refetchInterval: 5 * 60_000,
  });
}

/** Run the milestone sweep now. Normally Celery Beat does this daily at 03:30 UTC. */
export function useRunBenchSweep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<SweepResult>('/reverse-matching/bench-sweep'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reverseKeys.all });
    },
  });
}
