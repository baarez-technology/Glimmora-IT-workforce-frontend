'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, API_BASE_URL } from '@/lib/api';
import type {
  CommitResult,
  ImportBatch,
  ImportEntity,
  ImportEntityInfo,
  ImportPreview,
  Notification,
  NotificationCategory,
  UnreadCount,
} from '@/types/platform';

export const platformKeys = {
  notifications: (scope: Record<string, unknown>) => ['notifications', scope] as const,
  unread: () => ['notifications', 'unread-count'] as const,
  imports: () => ['imports'] as const,
  importPreview: (id: string) => ['imports', id] as const,
  importEntities: () => ['imports', 'entities'] as const,
};

function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['notifications'] });
}

/* ---------------------------------------------------------- notifications */

export function useNotifications(
  scope: { unread_only?: boolean; category?: NotificationCategory | '' } = {},
) {
  const query = Object.fromEntries(
    Object.entries(scope).filter(([, value]) => value !== undefined && value !== ''),
  );
  return useQuery({
    queryKey: platformKeys.notifications(query),
    queryFn: () => api.get<Notification[]>('/notifications', { query }),
  });
}

/**
 * The badge count.
 *
 * Polled rather than pushed: the sweeps run on a schedule, so a minute of
 * latency on an alert costs nothing, and a websocket for this would be
 * infrastructure with no matching benefit.
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: platformKeys.unread(),
    queryFn: () => api.get<UnreadCount>('/notifications/unread-count'),
    refetchInterval: 60_000,
  });
}

export function useMarkRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => api.post<Notification>(`/notifications/${id}/read`),
    onSuccess: invalidate,
  });
}

export function useMarkAllRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () => api.post<{ marked: number }>('/notifications/read-all'),
    onSuccess: invalidate,
  });
}

/**
 * Force every sweep now.
 *
 * Normally scheduled, but an administrator verifying the system works should
 * not have to wait for a cron tick. Safe to press: every alert dedupes.
 */
export function useRunSweeps() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () =>
      api.post<Record<string, { examined: number; raised: number }>>('/notifications/sweep'),
    onSuccess: invalidate,
  });
}

/* ---------------------------------------------------------------- imports */

export function useImportEntities() {
  return useQuery({
    queryKey: platformKeys.importEntities(),
    queryFn: () => api.get<ImportEntityInfo[]>('/imports/entities'),
    staleTime: 60 * 60_000,
  });
}

export function useImportBatches() {
  return useQuery({
    queryKey: platformKeys.imports(),
    queryFn: () => api.get<ImportBatch[]>('/imports'),
  });
}

export function useImportPreview(batchId: string | undefined) {
  return useQuery({
    queryKey: platformKeys.importPreview(batchId ?? ''),
    queryFn: () => api.get<ImportPreview>(`/imports/${batchId}/preview`),
    enabled: Boolean(batchId),
  });
}

/** Upload and validate. Writes nothing to business tables. */
export function useUploadImport(entity: ImportEntity) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post<ImportPreview>(`/imports/${entity}/upload`, form);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: platformKeys.imports() }),
  });
}

export function useCommitImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => api.post<CommitResult>(`/imports/${batchId}/commit`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: platformKeys.imports() });
      // The commit created real records, so every list is now stale.
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
      void queryClient.invalidateQueries({ queryKey: ['resources'] });
      void queryClient.invalidateQueries({ queryKey: ['requirements'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export function useDiscardImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => api.post<ImportBatch>(`/imports/${batchId}/discard`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: platformKeys.imports() }),
  });
}

/**
 * Download URLs.
 *
 * Plain hrefs rather than fetch-and-blob: the browser handles the save dialog,
 * the filename comes from the server's Content-Disposition, and the session
 * cookie rides along on a same-origin request.
 */
export const downloads = {
  template: (entity: ImportEntity) => `${API_BASE_URL}/imports/${entity}/template.xlsx`,
  errors: (batchId: string) => `${API_BASE_URL}/imports/${batchId}/errors.xlsx`,
  export: (entity: ImportEntity) => `${API_BASE_URL}/exports/${entity}.xlsx`,
};
