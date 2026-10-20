const API_PREFIX = '/api/v1';
const AUTH_ROUTES = new Set(['/login', '/register']);
export const API_UNAUTHORIZED_EVENT = 'api:unauthorized';

type ApiErrorBody = {
  error?: unknown;
  message?: unknown;
};

export type ApiRequestOptions = Omit<RequestInit, 'body' | 'credentials'> & {
  body?: unknown;
  redirectOnUnauthorized?: boolean;
};

export class ApiError extends Error {
  readonly details: string[];

  constructor(
    readonly statusCode: number,
    readonly error: string,
    message: string,
    details: string[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
    this.details = details;
  }
}

function isRecord(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;

  const contentType = response.headers.get('content-type') ?? '';
  if (
    contentType.includes('application/json') ||
    contentType.includes('+json')
  ) {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }

  return response.text();
}

function normalizeApiError(response: Response, body: unknown): ApiError {
  const payload = isRecord(body) ? body : undefined;
  const details = Array.isArray(payload?.message)
    ? payload.message.filter((item): item is string => typeof item === 'string')
    : [];
  const message =
    typeof payload?.message === 'string'
      ? payload.message
      : details.length > 0
        ? details.join(' ')
        : typeof body === 'string' && body.length > 0
          ? body
          : `Request failed with status ${response.status}.`;

  return new ApiError(
    response.status,
    typeof payload?.error === 'string'
      ? payload.error
      : response.statusText || 'Request failed',
    message,
    details,
  );
}

function redirectToLogin(): void {
  if (
    typeof window !== 'undefined' &&
    !AUTH_ROUTES.has(window.location.pathname)
  ) {
    window.dispatchEvent(new Event(API_UNAUTHORIZED_EVENT));
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, redirectOnUnauthorized = true, ...requestInit } = options;
  const headers = new Headers(requestInit.headers);
  headers.set('Accept', 'application/json');

  const isFormData =
    typeof FormData !== 'undefined' && body instanceof FormData;
  let requestBody: BodyInit | undefined;
  if (body !== undefined) {
    if (isFormData) {
      requestBody = body;
    } else {
      headers.set('Content-Type', 'application/json');
      requestBody = JSON.stringify(body);
    }
  }

  const response = await fetch(`${API_PREFIX}/${path.replace(/^\/+/, '')}`, {
    ...requestInit,
    body: requestBody,
    credentials: 'include',
    headers,
  });
  const responseBody = await readResponseBody(response);

  if (!response.ok) {
    const error = normalizeApiError(response, responseBody);
    if (error.statusCode === 401 && redirectOnUnauthorized) {
      redirectToLogin();
    }
    throw error;
  }

  return responseBody as T;
}
