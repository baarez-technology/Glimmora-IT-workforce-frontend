/**
 * Typed API client.
 *
 * One place that knows how to talk to the backend, so the error contract
 * (API.md section 1) is decoded once and every screen receives a typed
 * ApiError instead of a raw Response.
 */

import type { ApiErrorBody, ApiErrorDetail, ErrorCode } from '@/types/api';

/**
 * Relative by default: requests go to the Next.js origin, which proxies them to
 * the backend (see next.config.mjs). Same-origin keeps the httpOnly refresh
 * cookie working and removes CORS from the browser path entirely.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1';

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: ApiErrorDetail[];
  readonly requestId?: string;

  constructor(args: {
    code: ErrorCode;
    message: string;
    status: number;
    details?: ApiErrorDetail[];
    requestId?: string;
  }) {
    super(args.message);
    this.name = 'ApiError';
    this.code = args.code;
    this.status = args.status;
    this.details = args.details ?? [];
    this.requestId = args.requestId;
  }

  get isAuthError() {
    return this.code === 'UNAUTHENTICATED';
  }

  get isPermissionError() {
    return this.code === 'FORBIDDEN';
  }

  get isNotFound() {
    return this.code === 'NOT_FOUND';
  }

  /** Field errors keyed by field name, for react-hook-form setError. */
  get fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.details.map((detail) => [detail.field, detail.message]));
  }
}

/** Set by the auth store after login (Phase 3). Kept in memory, never in localStorage. */
let accessToken: string | null = null;
let onUnauthenticated: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setUnauthenticatedHandler(handler: (() => void) | null) {
  onUnauthenticated = handler;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Skip JSON parsing — used by document downloads. */
  raw?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const absolute = path.startsWith('http')
    ? path
    : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  // A relative base needs an origin to parse against; in the browser that is the
  // current page, and in tests it is jsdom's location.
  const origin = typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin;
  const url = new URL(absolute, origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function decodeError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // Non-JSON failure (proxy error, network appliance). Fall through.
  }

  if (body?.error) {
    return new ApiError({
      code: body.error.code,
      message: body.error.message,
      status: response.status,
      details: body.error.details,
      requestId: body.error.request_id,
    });
  }

  return new ApiError({
    code: response.status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
    message:
      response.status >= 500
        ? 'The server could not complete that request. Please try again.'
        : 'That request could not be completed.',
    status: response.status,
  });
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, raw, headers, ...rest } = options;

  const requestHeaders = new Headers(headers);
  if (accessToken) requestHeaders.set('Authorization', `Bearer ${accessToken}`);

  let requestBody: BodyInit | undefined;
  if (body instanceof FormData) {
    requestBody = body; // let the browser set the multipart boundary
  } else if (body !== undefined) {
    requestHeaders.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      ...rest,
      headers: requestHeaders,
      body: requestBody,
      credentials: 'include',
    });
  } catch {
    throw new ApiError({
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'Cannot reach the Glimmora API. Check that the backend is running.',
      status: 0,
    });
  }

  if (response.status === 401) {
    onUnauthenticated?.();
  }

  if (!response.ok) {
    throw await decodeError(response);
  }

  if (raw) return response as unknown as T;
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};
