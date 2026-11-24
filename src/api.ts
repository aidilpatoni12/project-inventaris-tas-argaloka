const TOKEN_KEY = 'argaloka_token';

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    /* abaikan error penyimpanan */
  }
}

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown; skipAuthRedirect?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, skipAuthRedirect = false } = opts;
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    if (res.status === 401 && !skipAuthRedirect) {
      setToken(null);
      onUnauthorized?.();
    }
    const errMsg =
      (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : null) || `Permintaan gagal (${res.status}).`;
    throw new Error(errMsg);
  }

  return data as T;
}
