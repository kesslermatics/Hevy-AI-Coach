/**
 * API utility for communicating with the FastAPI backend.
 */

const API_URL = import.meta.env.VITE_API_URL || 'https://hevy-ai-coach-production.up.railway.app';

/* ── Token helpers ──────────────────────────────────────── */

export const getToken  = (): string | null => localStorage.getItem('token');
export const setToken  = (t: string): void => { localStorage.setItem('token', t); };
export const removeToken = (): void        => { localStorage.removeItem('token'); };
export const isAuthenticated = (): boolean => getToken() !== null;

/* ── Generic request ────────────────────────────────────── */

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || `Error ${res.status}`);
  }

  return res.json();
}

/* ── Auth endpoints ─────────────────────────────────────── */

export const registerUser = (username: string, password: string) =>
  apiRequest<{ message: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

export const loginUser = async (username: string, password: string) => {
  const data = await apiRequest<{ access_token: string; token_type: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(data.access_token);
  return data;
};

export const logoutUser = () => { removeToken(); };

/* ── User endpoints ─────────────────────────────────────── */

export interface UserInfo {
  id: string;
  username: string;
  has_hevy_key: boolean;
  has_yazio: boolean;
}

export const getMe = () => apiRequest<UserInfo>('/user/me');

export const saveApiKey = (hevy_api_key: string) =>
  apiRequest<{ message: string; has_api_key: boolean }>('/user/api-key', {
    method: 'POST',
    body: JSON.stringify({ hevy_api_key }),
  });

export const saveYazioCredentials = (yazio_email: string, yazio_password: string) =>
  apiRequest<{ message: string; has_yazio: boolean }>('/user/yazio', {
    method: 'POST',
    body: JSON.stringify({ yazio_email, yazio_password }),
  });
