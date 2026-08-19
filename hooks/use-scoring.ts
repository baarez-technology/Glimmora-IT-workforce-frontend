'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type {
  CommercialFigures,
  CommercialPreviewRequest,
  OpportunityScoreResult,
  SimulationResult,
} from '@/types/scoring';

export const scoringKeys = {
  all: ['scoring'] as const,
  explain: (id: string) => ['scoring', id, 'explain'] as const,
  history: (id: string) => ['scoring', id, 'history'] as const,
  board: (band: string) => ['scoring', 'board', band] as const,
  simulation: (id: string) => ['scoring', 'simulate', id] as const,
};

/**
 * The full explainability object for one requirement.
 *
 * If nothing has been computed yet the backend scores on demand *without*
 * persisting, so opening the screen shows a real answer rather than an empty
 * shell — but a read still never leaves a snapshot behind.
 */
export function useScoreExplanation(requirementId: string | undefined) {
  return useQuery({
    queryKey: scoringKeys.explain(requirementId ?? ''),
    queryFn: () =>
      api.get<OpportunityScoreResult>(`/scoring/requirements/${requirementId}/explain`),
    enabled: Boolean(requirementId),
  });
}

export function useScoreHistory(requirementId: string | undefined) {
  return useQuery({
    queryKey: scoringKeys.history(requirementId ?? ''),
    queryFn: () =>
      api.get<OpportunityScoreResult[]>(`/scoring/requirements/${requirementId}/history`),
    enabled: Boolean(requirementId),
  });
}

export function useRecomputeScore(requirementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<OpportunityScoreResult>(`/scoring/requirements/${requirementId}/recompute`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: scoringKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

/** Current scores, ranked. One row per requirement — history stays in history. */
export function useOpportunityBoard(band = '') {
  return useQuery({
    queryKey: scoringKeys.board(band),
    queryFn: () =>
      api.get<OpportunityScoreResult[]>('/scoring/opportunities', {
        query: band ? { band } : undefined,
      }),
  });
}

/** What-if calculator. Persists nothing, so it is safe to fire on every edit. */
export function useCommercialPreview() {
  return useMutation({
    mutationFn: (input: CommercialPreviewRequest) =>
      api.post<CommercialFigures>('/scoring/commercial/preview', input),
  });
}

/** Re-score recent requirements under a draft rule set, before activating it. */
export function useSimulateConfig() {
  return useMutation({
    mutationFn: (configId: string) =>
      api.post<SimulationResult>(`/scoring/configurations/${configId}/simulate`),
  });
}
