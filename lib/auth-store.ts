'use client';

import { create } from 'zustand';

import { ApiError, api, setAccessToken, setUnauthenticatedHandler } from '@/lib/api';
import type { CurrentUser, Role } from '@/types/api';

/**
 * Session state.
 *
 * The access token lives in memory only — never localStorage, which is an XSS
 * exfiltration target. Continuity across a page reload comes from the httpOnly
 * refresh cookie, which JavaScript cannot read (SECURITY.md section 1).
 */

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_at: string;
  user: CurrentUser;
}

export type SessionStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  status: SessionStatus;
  user: CurrentUser | null;
  expiresAt: number | null;

  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  setUser: (user: CurrentUser) => void;

  can: (permission: string) => boolean;
  hasRole: (...roles: Role[]) => boolean;
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function clearRefreshTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function applySession(set: (partial: Partial<AuthState>) => void, payload: TokenResponse) {
  setAccessToken(payload.access_token);
  const expiresAt = new Date(payload.expires_at).getTime();
  set({ status: 'authenticated', user: payload.user, expiresAt });

  // Rotate a minute before expiry so an in-flight request never fails on a
  // token that lapsed mid-session.
  clearRefreshTimer();
  const delay = Math.max(15_000, expiresAt - Date.now() - 60_000);
  refreshTimer = setTimeout(() => {
    void useAuthStore.getState().refresh();
  }, delay);
}

function clearSession(set: (partial: Partial<AuthState>) => void) {
  clearRefreshTimer();
  setAccessToken(null);
  set({ status: 'anonymous', user: null, expiresAt: null });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'idle',
  user: null,
  expiresAt: null,

  /** Called once on mount: try to resume a session from the refresh cookie. */
  bootstrap: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading' });
    try {
      const payload = await api.post<TokenResponse>('/auth/refresh');
      applySession(set, payload);
    } catch {
      clearSession(set);
    }
  },

  login: async (email, password) => {
    const payload = await api.post<TokenResponse>('/auth/login', { email, password });
    applySession(set, payload);
    return payload.user;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Signing out locally must succeed even if the server call does not.
    }
    clearSession(set);
  },

  refresh: async () => {
    try {
      const payload = await api.post<TokenResponse>('/auth/refresh');
      applySession(set, payload);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        // Network blip, not a rejected session — keep the user signed in.
        return false;
      }
      clearSession(set);
      return false;
    }
  },

  setUser: (user) => set({ user }),

  can: (permission) => get().user?.permissions.includes(permission) ?? false,
  hasRole: (...roles) => {
    const role = get().user?.role;
    return role !== undefined && roles.includes(role);
  },
}));

// A 401 from any request means the session is gone; drop it rather than leaving
// the UI in a half-signed-in state.
setUnauthenticatedHandler(() => {
  const { status } = useAuthStore.getState();
  if (status === 'authenticated') {
    clearSession(useAuthStore.setState);
  }
});

/** Convenience selectors, so components do not subscribe to the whole store. */
export const useCurrentUser = () => useAuthStore((state) => state.user);
export const useSessionStatus = () => useAuthStore((state) => state.status);
export const usePermission = (permission: string) =>
  useAuthStore((state) => state.user?.permissions.includes(permission) ?? false);
