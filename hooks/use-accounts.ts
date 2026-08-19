'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { Page, PageQuery } from '@/types/api';
import type {
  Account,
  AccountRoute,
  AccountType,
  Activity,
  ActivityType,
  Contact,
  Project,
  ProjectStatus,
  RelationType,
  RelationshipStatus,
  Technology,
} from '@/types/accounts';

export const accountKeys = {
  all: ['accounts'] as const,
  list: (query: AccountQuery) => ['accounts', 'list', query] as const,
  detail: (id: string) => ['accounts', id] as const,
  routes: (id: string) => ['accounts', id, 'routes'] as const,
  timeline: (id: string) => ['accounts', id, 'timeline'] as const,
  contacts: (query: ContactQuery) => ['contacts', query] as const,
  projects: (query: ProjectQuery) => ['projects', query] as const,
  technologies: () => ['technologies'] as const,
  activities: (query: ActivityQuery) => ['activities', query] as const,
  followUps: (query: FollowUpQuery) => ['activities', 'follow-ups', query] as const,
};

export interface AccountQuery extends PageQuery {
  account_type?: AccountType | '';
  relationship_status?: RelationshipStatus | '';
  country?: string;
  is_existing_customer?: boolean | '';
  is_approved_vendor?: boolean | '';
}

export interface ContactQuery extends PageQuery {
  account_id?: string;
  is_decision_maker?: boolean | '';
}

export interface ProjectQuery extends PageQuery {
  account_id?: string;
  status?: ProjectStatus | '';
  technology_id?: string;
}

export interface ActivityQuery extends PageQuery {
  account_id?: string;
  contact_id?: string;
  project_id?: string;
  activity_type?: ActivityType | '';
}

export interface FollowUpQuery extends PageQuery {
  mine_only?: boolean;
  overdue_only?: boolean;
}

function clean<T extends object>(query: T): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== ''),
  ) as Record<string, string | number | boolean>;
}

/* ---------------------------------------------------------------- accounts */

export function useAccounts(query: AccountQuery) {
  return useQuery({
    queryKey: accountKeys.list(query),
    queryFn: () => api.get<Page<Account>>('/accounts', { query: clean(query) }),
    placeholderData: (previous) => previous,
  });
}

export function useAccount(id: string | undefined) {
  return useQuery({
    queryKey: accountKeys.detail(id ?? ''),
    queryFn: () => api.get<Account>(`/accounts/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Account>) => api.post<Account>('/accounts', input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: accountKeys.all }),
  });
}

export function useUpdateAccount(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Account>) => api.patch<Account>(`/accounts/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

/* ------------------------------------------------------------------ routes */

export function useAccountRoutes(id: string | undefined) {
  return useQuery({
    queryKey: accountKeys.routes(id ?? ''),
    queryFn: () => api.get<AccountRoute[]>(`/accounts/${id}/routes`),
    enabled: Boolean(id),
  });
}

export function useAddRoute(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      to_account_id: string;
      relation_type: RelationType;
      is_preferred_route: boolean;
      notes?: string;
    }) => api.post<AccountRoute>(`/accounts/${accountId}/routes`, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: accountKeys.all }),
  });
}

export function useRemoveRoute(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (routeId: string) => api.delete<void>(`/accounts/${accountId}/routes/${routeId}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: accountKeys.all }),
  });
}

/* ---------------------------------------------------------------- contacts */

export function useContacts(query: ContactQuery) {
  return useQuery({
    queryKey: accountKeys.contacts(query),
    queryFn: () => api.get<Page<Contact>>('/contacts', { query: clean(query) }),
    placeholderData: (previous) => previous,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Contact>) => api.post<Contact>('/contacts', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<Contact>) =>
      api.patch<Contact>(`/contacts/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}

/* ---------------------------------------------------------------- projects */

export function useProjects(query: ProjectQuery) {
  return useQuery({
    queryKey: accountKeys.projects(query),
    queryFn: () => api.get<Page<Project>>('/projects', { query: clean(query) }),
    placeholderData: (previous) => previous,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.post<Project>('/projects', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}

export function useTechnologies() {
  return useQuery({
    queryKey: accountKeys.technologies(),
    queryFn: () => api.get<Technology[]>('/technologies'),
    staleTime: 30 * 60_000,
  });
}

/* -------------------------------------------------------------- activities */

export function useActivities(query: ActivityQuery) {
  return useQuery({
    queryKey: accountKeys.activities(query),
    queryFn: () => api.get<Page<Activity>>('/activities', { query: clean(query) }),
    placeholderData: (previous) => previous,
  });
}

export function useAccountTimeline(accountId: string | undefined) {
  return useQuery({
    queryKey: accountKeys.timeline(accountId ?? ''),
    queryFn: () => api.get<Page<Activity>>(`/accounts/${accountId}/timeline`, {
      query: { page_size: 50 },
    }),
    enabled: Boolean(accountId),
  });
}

export function useFollowUps(query: FollowUpQuery) {
  return useQuery({
    queryKey: accountKeys.followUps(query),
    queryFn: () => api.get<Page<Activity>>('/activities/follow-ups', { query: clean(query) }),
    placeholderData: (previous) => previous,
  });
}

export function useLogActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.post<Activity>('/activities', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['activities'] });
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}

export function useCompleteFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (activityId: string) =>
      api.post<Activity>(`/activities/${activityId}/complete`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['activities'] });
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}
