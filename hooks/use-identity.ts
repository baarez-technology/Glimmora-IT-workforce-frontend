'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type {
  AuditLogEntry,
  Page,
  PageQuery,
  Role,
  RoleCatalogue,
  UserSummary,
} from '@/types/api';

export const identityKeys = {
  users: (query: UserQuery) => ['users', query] as const,
  user: (id: string) => ['users', id] as const,
  roles: () => ['roles'] as const,
  audit: (query: AuditQuery) => ['audit', query] as const,
  auditActions: () => ['audit', 'actions'] as const,
};

export interface UserQuery extends PageQuery {
  role?: Role | '';
  is_active?: boolean | '';
}

export interface AuditQuery extends PageQuery {
  action?: string;
  entity_type?: string;
}

function clean<T extends object>(query: T): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== ''),
  ) as Record<string, string | number | boolean>;
}

/* ------------------------------------------------------------------- users */

export function useUsers(query: UserQuery) {
  return useQuery({
    queryKey: identityKeys.users(query),
    queryFn: () => api.get<Page<UserSummary>>('/users', { query: clean(query) }),
    placeholderData: (previous) => previous,
  });
}

export interface CreateUserInput {
  email: string;
  full_name: string;
  role: Role;
  password: string;
  job_title?: string;
  must_change_password: boolean;
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => api.post<UserSummary>('/users', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<UserSummary>) =>
      api.patch<UserSummary>(`/users/${id}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<UserSummary>(`/users/${id}/deactivate`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

/* ------------------------------------------------------------------- roles */

export function useRoleCatalogue() {
  return useQuery({
    queryKey: identityKeys.roles(),
    queryFn: () => api.get<RoleCatalogue>('/roles'),
    staleTime: 30 * 60_000, // the matrix only changes on deploy
  });
}

/* ------------------------------------------------------------------- audit */

export function useAuditLog(query: AuditQuery) {
  return useQuery({
    queryKey: identityKeys.audit(query),
    queryFn: () => api.get<Page<AuditLogEntry>>('/audit', { query: clean(query) }),
    placeholderData: (previous) => previous,
  });
}

export function useAuditActions() {
  return useQuery({
    queryKey: identityKeys.auditActions(),
    queryFn: () => api.get<string[]>('/audit/actions'),
    staleTime: 30 * 60_000,
  });
}

/* ---------------------------------------------------------------- password */

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { current_password: string; new_password: string }) =>
      api.post<void>('/auth/change-password', input),
  });
}
