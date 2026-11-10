import type { Role } from './model';

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function request<T = void>(role: Role, path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch('/api/' + role + path, {
    method,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.error || 'The request could not be completed.');
  }
  return method === 'GET' ? response.json() : undefined as T;
}
