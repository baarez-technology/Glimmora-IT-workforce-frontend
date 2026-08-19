'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type {
  Communication,
  DuplicateCheck,
  Interview,
  InterviewOutcome,
  Opportunity,
  OpportunityDecision,
  OpportunityStage,
  StageHistoryEntry,
  StageInfo,
  Submission,
  SubmissionHistoryEntry,
  SubmissionStatus,
} from '@/types/pipeline';

export const pipelineKeys = {
  all: ['pipeline'] as const,
  stages: () => ['pipeline', 'stages'] as const,
  board: (mine: boolean) => ['pipeline', 'board', mine] as const,
  opportunity: (id: string) => ['pipeline', 'opportunity', id] as const,
  opportunityHistory: (id: string) => ['pipeline', 'opportunity', id, 'history'] as const,
  submissions: (query: Record<string, unknown>) => ['pipeline', 'submissions', query] as const,
  submissionHistory: (id: string) => ['pipeline', 'submission', id, 'history'] as const,
  interviews: (days: number) => ['pipeline', 'interviews', days] as const,
  communications: (scope: Record<string, unknown>) =>
    ['pipeline', 'communications', scope] as const,
};

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: pipelineKeys.all });
    void queryClient.invalidateQueries({ queryKey: ['audit'] });
  };
}

/** The stage ladder, served by the API so the UI cannot drift from the engine. */
export function usePipelineStages() {
  return useQuery({
    queryKey: pipelineKeys.stages(),
    queryFn: () => api.get<StageInfo[]>('/opportunities/stages'),
    staleTime: 60 * 60_000,
  });
}

export function usePipelineBoard(mine = false) {
  return useQuery({
    queryKey: pipelineKeys.board(mine),
    queryFn: () => api.get<Opportunity[]>('/opportunities', { query: { mine } }),
  });
}

export function useOpportunity(id: string | undefined) {
  return useQuery({
    queryKey: pipelineKeys.opportunity(id ?? ''),
    queryFn: () => api.get<Opportunity>(`/opportunities/${id}`),
    enabled: Boolean(id),
  });
}

export function useOpportunityHistory(id: string | undefined) {
  return useQuery({
    queryKey: pipelineKeys.opportunityHistory(id ?? ''),
    queryFn: () => api.get<StageHistoryEntry[]>(`/opportunities/${id}/history`),
    enabled: Boolean(id),
  });
}

export function useOpenOpportunity() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (requirementId: string) =>
      api.post<Opportunity>('/opportunities', { requirement_id: requirementId }),
    onSuccess: invalidate,
  });
}

export function useChangeStage(opportunityId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { stage: OpportunityStage; note?: string }) =>
      api.post<Opportunity>(`/opportunities/${opportunityId}/stage`, input),
    onSuccess: invalidate,
  });
}

export function useRecordDecision(opportunityId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { decision: OpportunityDecision; reason?: string }) =>
      api.post<Opportunity>(`/opportunities/${opportunityId}/decision`, input),
    onSuccess: invalidate,
  });
}

export function useUpdateOpportunity(opportunityId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.patch<Opportunity>(`/opportunities/${opportunityId}`, input),
    onSuccess: invalidate,
  });
}

/* ------------------------------------------------------------- submissions */

export function useSubmissions(query: { requirement_id?: string; status?: string } = {}) {
  const clean = Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== ''),
  );
  return useQuery({
    queryKey: pipelineKeys.submissions(clean),
    queryFn: () => api.get<Submission[]>('/submissions', { query: clean }),
  });
}

export function useSubmissionHistory(id: string | undefined) {
  return useQuery({
    queryKey: pipelineKeys.submissionHistory(id ?? ''),
    queryFn: () => api.get<SubmissionHistoryEntry[]>(`/submissions/${id}/history`),
    enabled: Boolean(id),
  });
}

/**
 * Pre-flight duplicate check.
 *
 * Warning before the user commits is the whole point — discovering it on submit
 * means they have already told the client somebody was coming.
 */
export function useDuplicateCheck(requirementId?: string, resourceId?: string) {
  return useQuery({
    queryKey: ['pipeline', 'duplicate', requirementId ?? '', resourceId ?? ''],
    queryFn: () =>
      api.get<DuplicateCheck>('/submissions/check-duplicate', {
        query: { requirement_id: requirementId ?? '', resource_id: resourceId ?? '' },
      }),
    enabled: Boolean(requirementId && resourceId),
  });
}

export function useCreateSubmission() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.post<Submission>('/submissions', input),
    onSuccess: invalidate,
  });
}

export function useChangeSubmissionStatus(submissionId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: {
      status: SubmissionStatus;
      note?: string;
      client_feedback?: string;
      rejection_reason?: string;
    }) => api.post<Submission>(`/submissions/${submissionId}/status`, input),
    onSuccess: invalidate,
  });
}

/* -------------------------------------------------------------- interviews */

export function useInterviews(daysAhead = 30) {
  return useQuery({
    queryKey: pipelineKeys.interviews(daysAhead),
    queryFn: () => api.get<Interview[]>('/interviews', { query: { days_ahead: daysAhead } }),
  });
}

export function useScheduleInterview() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.post<Interview>('/interviews', input),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useRecordInterviewOutcome(interviewId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { outcome: InterviewOutcome; feedback?: string }) =>
      api.post<Interview>(`/interviews/${interviewId}/outcome`, input),
    onSuccess: invalidate,
  });
}

/* ---------------------------------------------------------- communications */

export function useCommunications(scope: { opportunity_id?: string; submission_id?: string }) {
  const clean = Object.fromEntries(Object.entries(scope).filter(([, value]) => Boolean(value)));
  return useQuery({
    queryKey: pipelineKeys.communications(clean),
    queryFn: () => api.get<Communication[]>('/communications', { query: clean }),
    enabled: Object.keys(clean).length > 0,
  });
}

export function useLogCommunication() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.post<Communication>('/communications', input),
    onSuccess: invalidate,
  });
}
