'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { Page, PageQuery } from '@/types/api';
import type {
  DeadlineBoard,
  ParseResult,
  PrioritySource,
  Requirement,
  RequirementStatus,
  RequirementStatusHistoryEntry,
  ReviewStatus,
  SkillOption,
} from '@/types/demand';

export const requirementKeys = {
  all: ['requirements'] as const,
  list: (query: RequirementQuery) => ['requirements', 'list', query] as const,
  detail: (id: string) => ['requirements', id] as const,
  parseResult: (id: string) => ['requirements', id, 'parse-result'] as const,
  history: (id: string) => ['requirements', id, 'history'] as const,
  deadlines: () => ['requirements', 'deadlines'] as const,
  skills: (q: string) => ['skills', q] as const,
};

export interface RequirementQuery extends PageQuery {
  status?: RequirementStatus | '';
  priority_source?: PrioritySource | '';
  review_status?: ReviewStatus | '';
  account_id?: string;
  skill_id?: string;
  open_only?: boolean;
}

function clean<T extends object>(query: T): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== ''),
  ) as Record<string, string | number | boolean>;
}

export function useRequirements(query: RequirementQuery) {
  return useQuery({
    queryKey: requirementKeys.list(query),
    queryFn: () => api.get<Page<Requirement>>('/requirements', { query: clean(query) }),
    placeholderData: (previous) => previous,
  });
}

export function useRequirement(id: string | undefined) {
  return useQuery({
    queryKey: requirementKeys.detail(id ?? ''),
    queryFn: () => api.get<Requirement>(`/requirements/${id}`),
    enabled: Boolean(id),
  });
}

export function useRequirementHistory(id: string | undefined) {
  return useQuery({
    queryKey: requirementKeys.history(id ?? ''),
    queryFn: () => api.get<RequirementStatusHistoryEntry[]>(`/requirements/${id}/history`),
    enabled: Boolean(id),
  });
}

export function useParseResult(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: requirementKeys.parseResult(id ?? ''),
    queryFn: () => api.get<ParseResult>(`/requirements/${id}/parse-result`),
    enabled: Boolean(id) && enabled,
  });
}

/**
 * The SLA board. Refetched on an interval because its whole point is that the
 * window is closing — a stale board is worse than none.
 */
export function useDeadlineBoard() {
  return useQuery({
    queryKey: requirementKeys.deadlines(),
    queryFn: () => api.get<DeadlineBoard>('/requirements/deadlines'),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useSkillSearch(query: string) {
  return useQuery({
    queryKey: requirementKeys.skills(query),
    queryFn: () => api.get<SkillOption[]>('/skills', { query: clean({ q: query, limit: 100 }) }),
    staleTime: 5 * 60_000,
  });
}

/* ------------------------------------------------------------- mutations */

function useInvalidateRequirements() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: requirementKeys.all });
    void queryClient.invalidateQueries({ queryKey: ['audit'] });
  };
}

export function useCreateRequirement() {
  const invalidate = useInvalidateRequirements();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.post<Requirement>('/requirements', input),
    onSuccess: invalidate,
  });
}

export function useUpdateRequirement(id: string) {
  const invalidate = useInvalidateRequirements();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.patch<Requirement>(`/requirements/${id}`, input),
    onSuccess: invalidate,
  });
}

/**
 * Archive a requirement.
 *
 * Soft-delete. Submissions and scores that referenced it keep their meaning —
 * a requirement withdrawn by the client is still why the work was done.
 */
export function useArchiveRequirement() {
  const invalidate = useInvalidateRequirements();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/requirements/${id}`),
    onSuccess: invalidate,
  });
}

export function useParseText() {
  const invalidate = useInvalidateRequirements();
  return useMutation({
    mutationFn: (input: {
      text: string;
      source?: string;
      priority_source?: PrioritySource;
      account_id?: string;
      project_id?: string;
    }) => api.post<Requirement>('/requirements/parse-text', input),
    onSuccess: invalidate,
  });
}

export function useParseDocument() {
  const invalidate = useInvalidateRequirements();
  return useMutation({
    mutationFn: (input: { file: File; priority_source?: PrioritySource; account_id?: string }) => {
      const form = new FormData();
      form.append('file', input.file);
      if (input.priority_source) form.append('priority_source', input.priority_source);
      if (input.account_id) form.append('account_id', input.account_id);
      return api.post<Requirement>('/requirements/parse-document', form);
    },
    onSuccess: invalidate,
  });
}

export function useAcceptParse(id: string) {
  const invalidate = useInvalidateRequirements();
  return useMutation({
    mutationFn: (input: {
      confirmed_fields: string[];
      updates?: Record<string, unknown>;
      skills?: Array<{ name: string; importance: string; min_years?: number | null }>;
    }) => api.post<Requirement>(`/requirements/${id}/accept-parse`, input),
    onSuccess: invalidate,
  });
}

export function useRejectParse(id: string) {
  const invalidate = useInvalidateRequirements();
  return useMutation({
    mutationFn: (reason?: string) =>
      api.post<Requirement>(`/requirements/${id}/reject-parse`, undefined, {
        query: reason ? { reason } : undefined,
      }),
    onSuccess: invalidate,
  });
}

export function useChangeRequirementStatus(id: string) {
  const invalidate = useInvalidateRequirements();
  return useMutation({
    mutationFn: (input: { status: RequirementStatus; reason?: string }) =>
      api.post<Requirement>(`/requirements/${id}/status`, input),
    onSuccess: invalidate,
  });
}
