'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { Page, PageQuery } from '@/types/api';
import type {
  AvailabilityStatus,
  CVParseResult,
  DuplicateMatch,
  ExpiringDocuments,
  Resource,
  ResourceDocument,
  ResourceType,
  VisaStatus,
} from '@/types/talent';

export const talentKeys = {
  all: ['resources'] as const,
  list: (query: ResourceQuery) => ['resources', 'list', query] as const,
  detail: (id: string) => ['resources', id] as const,
  documents: (id: string) => ['resources', id, 'documents'] as const,
  parseResult: (id: string) => ['resources', id, 'parse-result'] as const,
  bench: () => ['resources', 'bench'] as const,
  expiring: (days: number) => ['documents', 'expiring', days] as const,
};

export interface ResourceQuery extends PageQuery {
  resource_type?: ResourceType | '';
  availability_status?: AvailabilityStatus | '';
  visa_status?: VisaStatus | '';
  country?: string;
  skill_id?: string;
  max_notice_days?: number | '';
  bench_only?: boolean;
}

function clean<T extends object>(query: T): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== ''),
  ) as Record<string, string | number | boolean>;
}

export function useResources(query: ResourceQuery, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: talentKeys.list(query),
    queryFn: () => api.get<Page<Resource>>('/resources', { query: clean(query) }),
    placeholderData: (previous) => previous,
    enabled,
  });
}

/**
 * Ready now, or ready within `withinDays`.
 *
 * Not the same list as the bench, which is why it has its own endpoint: this
 * one accounts for notice period, so somebody available in three weeks on a
 * thirty-day notice does not appear as ready in twenty-one days.
 */
export function useAvailableResources(
  query: ResourceQuery & { within_days?: number },
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ['resources', 'available', query],
    queryFn: () => api.get<Page<Resource>>('/resources/available', { query: clean(query) }),
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useResource(id: string | undefined) {
  return useQuery({
    queryKey: talentKeys.detail(id ?? ''),
    queryFn: () => api.get<Resource>(`/resources/${id}`),
    enabled: Boolean(id),
  });
}

export function useResourceDocuments(id: string | undefined) {
  return useQuery({
    queryKey: talentKeys.documents(id ?? ''),
    queryFn: () => api.get<ResourceDocument[]>(`/resources/${id}/documents`),
    enabled: Boolean(id),
  });
}

export function useCVParseResult(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: talentKeys.parseResult(id ?? ''),
    queryFn: () => api.get<CVParseResult>(`/resources/${id}/parse-result`),
    enabled: Boolean(id) && enabled,
  });
}

/**
 * Documents expired or expiring. Refetched periodically: an expired work permit
 * stops billing, so a stale board costs money.
 */
export function useExpiringDocuments(daysAhead = 60) {
  return useQuery({
    queryKey: talentKeys.expiring(daysAhead),
    queryFn: () =>
      api.get<ExpiringDocuments>('/documents/expiring', { query: { days_ahead: daysAhead } }),
    refetchInterval: 5 * 60_000,
  });
}

export function useDuplicateCheck(params: { email?: string; phone?: string; full_name?: string }) {
  const enabled = Boolean(params.email || params.phone || params.full_name);
  return useQuery({
    queryKey: ['resources', 'check-duplicate', params],
    queryFn: () => api.get<DuplicateMatch[]>('/resources/check-duplicate', { query: clean(params) }),
    enabled,
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: talentKeys.all });
    void queryClient.invalidateQueries({ queryKey: ['documents'] });
    void queryClient.invalidateQueries({ queryKey: ['audit'] });
  };
}

export function useCreateResource() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.post<Resource>('/resources', input),
    onSuccess: invalidate,
  });
}

export function useUpdateResource(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.patch<Resource>(`/resources/${id}`, input),
    onSuccess: invalidate,
  });
}

/**
 * Archive a consultant.
 *
 * Soft-delete, and the API refuses while they are actively deployed — removing
 * somebody mid-engagement would orphan the billing that depends on them.
 */
export function useArchiveResource() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/resources/${id}`),
    onSuccess: invalidate,
  });
}

export function useParseCV() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post<CVParseResult>('/resources/parse-cv', form);
    },
    onSuccess: invalidate,
  });
}

export function useAcceptCV(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { confirmed_fields: string[]; updates?: Record<string, unknown> }) =>
      api.post<Resource>(`/resources/${id}/accept-parse`, input),
    onSuccess: invalidate,
  });
}

export function useUploadDocument(resourceId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: {
      file: File;
      doc_type: string;
      title?: string;
      issue_date?: string;
      expiry_date?: string;
      issuing_country?: string;
      reference_number?: string;
    }) => {
      const form = new FormData();
      form.append('file', input.file);
      form.append('doc_type', input.doc_type);
      for (const key of [
        'title',
        'issue_date',
        'expiry_date',
        'issuing_country',
        'reference_number',
      ] as const) {
        const value = input[key];
        if (value) form.append(key, value);
      }
      return api.post<ResourceDocument>(`/resources/${resourceId}/documents`, form);
    },
    onSuccess: invalidate,
  });
}

/**
 * Correct a document's details — above all its expiry date.
 *
 * A visa recorded with the wrong expiry either raises an alarm that is not real
 * or, worse, stays silent through one that is. Fixing the date must not require
 * deleting the file and uploading it again.
 */
export function useUpdateDocument() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      api.patch<ResourceDocument>(`/documents/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteDocument() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (documentId: string) => api.delete<void>(`/documents/${documentId}`),
    onSuccess: invalidate,
  });
}

/** Downloads go through the authorised, audited endpoint — never a direct URL. */
export function documentDownloadUrl(documentId: string): string {
  return `/api/v1/documents/${documentId}/download`;
}
