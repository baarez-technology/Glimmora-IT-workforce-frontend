'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type {
  AdminDashboard,
  BillingHeadline,
  BillingRecord,
  BillingStatus,
  Deployment,
  DeploymentStatus,
  EndingSoonRow,
  Funnel,
  HrDashboard,
  ManagementDashboard,
  MonthlySummaryRow,
  ProjectionResult,
  SalesDashboard,
} from '@/types/delivery';

export const deliveryKeys = {
  all: ['delivery'] as const,
  deployments: (query: Record<string, unknown>) => ['delivery', 'deployments', query] as const,
  deployment: (id: string) => ['delivery', 'deployment', id] as const,
  endingSoon: (days: number) => ['delivery', 'ending-soon', days] as const,
  billing: (query: Record<string, unknown>) => ['delivery', 'billing', query] as const,
  summary: (months: number) => ['delivery', 'billing', 'summary', months] as const,
  headline: () => ['delivery', 'billing', 'headline'] as const,
  dashboard: (name: string) => ['dashboard', name] as const,
};

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: deliveryKeys.all });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['audit'] });
  };
}

function clean<T extends object>(query: T): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== ''),
  ) as Record<string, string | number | boolean>;
}

/* ------------------------------------------------------------ deployments */

export function useDeployments(
  query: { status?: DeploymentStatus | ''; resource_id?: string; account_id?: string } = {},
) {
  const params = clean(query);
  return useQuery({
    queryKey: deliveryKeys.deployments(params),
    queryFn: () => api.get<Deployment[]>('/deployments', { query: params }),
  });
}

export function useDeployment(id: string | undefined) {
  return useQuery({
    queryKey: deliveryKeys.deployment(id ?? ''),
    queryFn: () => api.get<Deployment>(`/deployments/${id}`),
    enabled: Boolean(id),
  });
}

/** Deployments approaching their end. The redeployment engine's input. */
export function useEndingSoon(daysAhead = 90) {
  return useQuery({
    queryKey: deliveryKeys.endingSoon(daysAhead),
    queryFn: () =>
      api.get<EndingSoonRow[]>('/deployments/ending-soon', { query: { days_ahead: daysAhead } }),
  });
}

export function useCreateDeployment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.post<Deployment>('/deployments', input),
    onSuccess: invalidate,
  });
}

export function useEndDeployment(deploymentId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { actual_end_date: string; reason?: string }) =>
      api.post<Deployment>(`/deployments/${deploymentId}/end`, input),
    onSuccess: invalidate,
  });
}

export function useExtendDeployment(deploymentId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.post<Deployment>(`/deployments/${deploymentId}/extend`, input),
    onSuccess: invalidate,
  });
}

/* ---------------------------------------------------------------- billing */

export function useBillingRecords(
  query: { year?: number; month?: number; status?: BillingStatus | ''; deployment_id?: string } = {},
) {
  const params = clean(query);
  return useQuery({
    queryKey: deliveryKeys.billing(params),
    queryFn: () => api.get<BillingRecord[]>('/billing/records', { query: params }),
  });
}

export function useBillingSummary(months = 12) {
  return useQuery({
    queryKey: deliveryKeys.summary(months),
    queryFn: () => api.get<MonthlySummaryRow[]>('/billing/summary', { query: { months } }),
  });
}

/** The headline metric, with confirmed and projected kept apart. */
export function useBillingHeadline() {
  return useQuery({
    queryKey: deliveryKeys.headline(),
    queryFn: () => api.get<BillingHeadline>('/billing/monthly-revenue'),
  });
}

export function useGenerateProjections() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (deploymentId?: string) =>
      api.post<ProjectionResult>(
        '/billing/generate-projections',
        undefined,
        deploymentId ? { query: { deployment_id: deploymentId } } : undefined,
      ),
    onSuccess: invalidate,
  });
}

export function useConfirmBilling(recordId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { revenue_amount?: string; cost_amount?: string; notes?: string }) =>
      api.post<BillingRecord>(`/billing/records/${recordId}/confirm`, input),
    onSuccess: invalidate,
  });
}

/* ------------------------------------------------------------- dashboards */

export function useFunnel() {
  return useQuery({
    queryKey: deliveryKeys.dashboard('funnel'),
    queryFn: () => api.get<Funnel>('/dashboard/funnel'),
  });
}

export function useManagementDashboard(enabled = true) {
  return useQuery({
    queryKey: deliveryKeys.dashboard('management'),
    queryFn: () => api.get<ManagementDashboard>('/dashboard/management'),
    enabled,
  });
}

export function useSalesDashboard(enabled = true) {
  return useQuery({
    queryKey: deliveryKeys.dashboard('sales'),
    queryFn: () => api.get<SalesDashboard>('/dashboard/sales'),
    enabled,
  });
}

export function useHrDashboard(enabled = true) {
  return useQuery({
    queryKey: deliveryKeys.dashboard('hr'),
    queryFn: () => api.get<HrDashboard>('/dashboard/hr'),
    enabled,
  });
}

export function useAdminDashboard(enabled = true) {
  return useQuery({
    queryKey: deliveryKeys.dashboard('admin'),
    queryFn: () => api.get<AdminDashboard>('/dashboard/admin'),
    enabled,
  });
}
