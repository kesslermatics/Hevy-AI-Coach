/**
 * API utility for communicating with the FastAPI backend.
 * Handles authentication tokens and common request patterns.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Get the stored auth token from localStorage.
 */
export const getToken = (): string | null => {
  return localStorage.getItem('token');
};

/**
 * Set the auth token in localStorage.
 */
export const setToken = (token: string): void => {
  localStorage.setItem('token', token);
};

/**
 * Remove the auth token from localStorage.
 */
export const removeToken = (): void => {
  localStorage.removeItem('token');
};

/**
 * Check if user is authenticated.
 */
export const isAuthenticated = (): boolean => {
  return getToken() !== null;
};

/**
 * Generic API request function with authentication support.
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// ============ Auth API ============

interface RegisterData {
  username: string;
  password: string;
}

interface LoginData {
  username: string;
  password: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
}

interface MessageResponse {
  message: string;
}

export interface UserResponse {
  id: string;
  username: string;
  has_api_key: boolean;
}

interface ApiKeyResponse {
  message: string;
  has_api_key: boolean;
}

/**
 * Register a new user.
 */
export const register = async (data: RegisterData): Promise<MessageResponse> => {
  return apiRequest<MessageResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/**
 * Login user and store token.
 */
export const login = async (data: LoginData): Promise<TokenResponse> => {
  const response = await apiRequest<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  setToken(response.access_token);
  return response;
};

/**
 * Logout user by removing token.
 */
export const logout = (): void => {
  removeToken();
};

/**
 * Get current user info.
 */
export const getCurrentUser = async (): Promise<UserResponse> => {
  return apiRequest<UserResponse>('/user/me');
};

/**
 * Update Hevy API key.
 */
export const updateApiKey = async (apiKey: string): Promise<ApiKeyResponse> => {
  return apiRequest<ApiKeyResponse>('/user/api-key', {
    method: 'POST',
    body: JSON.stringify({ hevy_api_key: apiKey }),
  });
};

/**
 * Delete Hevy API key.
 */
export const deleteApiKey = async (): Promise<ApiKeyResponse> => {
  return apiRequest<ApiKeyResponse>('/user/api-key', {
    method: 'DELETE',
  });
};

export default {
  register,
  login,
  logout,
  getCurrentUser,
  updateApiKey,
  deleteApiKey,
  isAuthenticated,
  getToken,
  setToken,
  removeToken,
};
