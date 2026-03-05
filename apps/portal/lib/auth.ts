'use client';

const TOKEN_KEY = 'portal_token';
const CONSUMER_KEY = 'portal_consumer';

export interface PortalConsumer {
  id: string;
  email: string;
  name: string | null;
  locale: string;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuth(token: string, consumer: PortalConsumer): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(CONSUMER_KEY, JSON.stringify(consumer));
}

export function getConsumer(): PortalConsumer | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(CONSUMER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PortalConsumer;
  } catch {
    return null;
  }
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CONSUMER_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}
