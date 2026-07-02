// Token storage for the admin app. Access + refresh tokens live in localStorage
// (client-only); the API is the real authorization boundary — this is just where
// we keep the credentials the API client attaches. Cleared on logout / hard 401.

const ACCESS_KEY = 'loop_admin_access';
const REFRESH_KEY = 'loop_admin_refresh';

const hasWindow = () => typeof window !== 'undefined';

export function getAccessToken(): string | null {
  return hasWindow() ? window.localStorage.getItem(ACCESS_KEY) : null;
}

export function getRefreshToken(): string | null {
  return hasWindow() ? window.localStorage.getItem(REFRESH_KEY) : null;
}

export function setTokens(accessToken: string, refreshToken: string): void {
  if (!hasWindow()) return;
  window.localStorage.setItem(ACCESS_KEY, accessToken);
  window.localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
  if (!hasWindow()) return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

export function isAuthenticated(): boolean {
  return getAccessToken() != null;
}
