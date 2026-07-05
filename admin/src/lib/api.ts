'use client';

import axios, {
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from './auth';

// THE single API client for the admin app. Base URL comes from the environment
// (never hard-coded). It attaches the access token on every request and, on a
// 401, transparently refreshes once against the same NestJS API before retrying.
const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export const api = axios.create({ baseURL });

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Serialize concurrent refreshes: the first 401 refreshes; the rest wait on it.
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    // Bare axios (not `api`) so this request skips the interceptors below.
    const { data } = await axios.post(`${baseURL}/auth/refresh`, {
      refreshToken,
    });
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken as string;
  } catch {
    return null;
  }
}

function redirectToLogin() {
  clearTokens();
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as
      | (AxiosRequestConfig & {
          _retried?: boolean;
        })
      | undefined;
    const status = error.response?.status;
    const isRefreshCall = original?.url?.includes('/auth/refresh');

    if (status === 401 && original && !original._retried && !isRefreshCall) {
      original._retried = true;
      refreshing = refreshing ?? refreshAccessToken();
      const newToken = await refreshing;
      refreshing = null;

      if (newToken) {
        original.headers = {
          ...original.headers,
          Authorization: `Bearer ${newToken}`,
        };
        return api(original);
      }
      // Refresh failed → credentials are dead. Bounce to login.
      redirectToLogin();
    }
    return Promise.reject(error);
  },
);
