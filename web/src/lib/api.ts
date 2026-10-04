import { getSocketId } from './socket';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export async function api<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  const socketId = getSocketId();
  if (socketId) headers['x-socket-id'] = socketId;
  // Fastify rejects an empty JSON body, so mutations always send at least {}.
  const hasBody = method !== 'GET' && method !== 'HEAD';
  if (hasBody) headers['content-type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      credentials: 'same-origin',
      body: hasBody ? JSON.stringify(body ?? {}) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }

  const text = await res.text();
  let data: unknown = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (!res.ok) {
    const { error, ...details } = (data ?? {}) as { error?: string };
    if (res.status === 401 && !url.startsWith('/api/auth/login')) onUnauthorized?.();
    throw new ApiError(res.status, error ?? `Request failed (${res.status})`, details);
  }
  return data as T;
}

export const get = <T>(url: string) => api<T>('GET', url);
export const post = <T>(url: string, body?: unknown) => api<T>('POST', url, body);
export const patch = <T>(url: string, body?: unknown) => api<T>('PATCH', url, body);
export const put = <T>(url: string, body?: unknown) => api<T>('PUT', url, body);
export const del = <T>(url: string, body?: unknown) => api<T>('DELETE', url, body);
