'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { HealthResponse, PublicConfig } from '@/types/api';

export const systemKeys = {
  all: ['system'] as const,
  health: () => [...systemKeys.all, 'health'] as const,
  config: () => [...systemKeys.all, 'config'] as const,
};

export function useHealth() {
  return useQuery({
    queryKey: systemKeys.health(),
    queryFn: () => api.get<HealthResponse>('/system/health'),
    refetchInterval: 60_000,
  });
}

export function usePublicConfig() {
  return useQuery({
    queryKey: systemKeys.config(),
    queryFn: () => api.get<PublicConfig>('/system/config'),
    staleTime: 10 * 60_000,
  });
}
