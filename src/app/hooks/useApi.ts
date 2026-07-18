import { useCallback } from 'react';
import { useAuth, API_BASE } from '../contexts/AuthContext';

interface ApiOptions {
  method?: string;
  body?: unknown;
}

export function useApi() {
  const { token, logout } = useAuth();

  const request = useCallback(
    async <T = unknown>(path: string, options: ApiOptions = {}): Promise<T> => {
      const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;

      const headers: Record<string, string> = {};
      // Let the browser set the multipart boundary for FormData — do not set Content-Type.
      if (!isForm) headers['Content-Type'] = 'application/json';
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}${path}`, {
        method: options.method || 'GET',
        headers,
        body: isForm
          ? (options.body as FormData)
          : options.body
            ? JSON.stringify(options.body)
            : undefined,
      });

      if (res.status === 401) {
        logout();
        throw new Error('Session expired');
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      if (res.status === 204) return undefined as T;
      return res.json() as Promise<T>;
    },
    [token, logout],
  );

  return { request };
}
