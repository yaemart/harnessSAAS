'use client';

import { getToken, clearAuth } from './auth';

const API_BASE = process.env.NEXT_PUBLIC_PORTAL_API_URL ?? 'http://localhost:3000/portal';

const SAFE_ERROR_MESSAGES: Record<number, string> = {
  400: 'Invalid request. Please check your input.',
  401: 'Session expired. Please sign in again.',
  403: 'Access denied.',
  404: 'Not found.',
  409: 'This item already exists.',
  429: 'Too many requests. Please wait a moment.',
  500: 'Something went wrong. Please try again later.',
};

class PortalClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public serverMessage?: string,
  ) {
    super(message);
    this.name = 'PortalClientError';
  }
}

function safeErrorMessage(status: number, serverMsg?: string): string {
  const knownSafe = [
    'Serial number already registered',
    'Please wait before requesting a new code.',
    'Too many attempts. Please request a new code.',
    'Invalid or expired verification code',
    'Verification code sent',
  ];
  if (serverMsg && knownSafe.some((s) => serverMsg.includes(s))) {
    return serverMsg;
  }
  return SAFE_ERROR_MESSAGES[status] ?? 'An unexpected error occurred.';
}

async function clientFetch<T>(
  path: string,
  init?: RequestInit & { auth?: boolean },
): Promise<T> {
  const { auth = false, ...fetchInit } = init ?? {};
  const headers: Record<string, string> = {};

  if (fetchInit.body) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = getToken();
    if (!token) {
      clearAuth();
      if (typeof window !== 'undefined') {
        window.location.href = '/warranty';
      }
      throw new PortalClientError(401, 'Not authenticated');
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchInit,
    headers: { ...headers, ...fetchInit.headers as Record<string, string> },
  });

  if (res.status === 401 && auth) {
    clearAuth();
    if (typeof window !== 'undefined') {
      window.location.href = '/warranty';
    }
    throw new PortalClientError(401, 'Session expired. Please sign in again.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const serverMsg = body.error as string | undefined;
    throw new PortalClientError(res.status, safeErrorMessage(res.status, serverMsg), serverMsg);
  }

  return res.json() as Promise<T>;
}

export interface SendCodeResponse {
  success: boolean;
  message: string;
}

export interface VerifyCodeResponse {
  token: string;
  consumer: {
    id: string;
    email: string;
    name: string | null;
    locale: string;
  };
}

export interface WarrantyRecord {
  id: string;
  serialNumber: string;
  purchaseDate: string;
  purchaseChannel: string;
  expiryDate: string;
  status: string;
  activatedAt: string;
  createdAt: string;
  commodity: {
    id: string;
    title: string;
    product: {
      name: string;
      imageUrls: string[];
    };
  };
}

export async function sendOTP(email: string, brandId: string): Promise<SendCodeResponse> {
  return clientFetch('/auth/send-code', {
    method: 'POST',
    body: JSON.stringify({ email, brandId }),
  });
}

export async function verifyOTP(
  email: string,
  brandId: string,
  code: string,
): Promise<VerifyCodeResponse> {
  return clientFetch('/auth/verify-code', {
    method: 'POST',
    body: JSON.stringify({ email, brandId, code }),
  });
}

export async function fetchMyWarranties(
  cursor?: string,
): Promise<{ warranties: WarrantyRecord[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  const qs = params.toString();
  return clientFetch(`/warranties${qs ? `?${qs}` : ''}`, { auth: true });
}

export async function registerWarranty(data: {
  commodityId: string;
  serialNumber: string;
  purchaseDate: string;
  purchaseChannel: string;
}): Promise<{ warranty: WarrantyRecord }> {
  return clientFetch('/warranties', {
    method: 'POST',
    body: JSON.stringify(data),
    auth: true,
  });
}

// --- Support Cases ---

export interface CaseMessage {
  id: string;
  role: 'consumer' | 'agent' | 'system';
  contentType: string;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface SupportCase {
  id: string;
  commodityId: string;
  status: string;
  issueType: string | null;
  agentConfidence: number | null;
  createdAt: string;
  updatedAt: string;
  commodity?: {
    id: string;
    title: string;
    product: { name: string; imageUrls: string[] };
  };
  messages?: CaseMessage[];
  _count?: { messages: number };
}

export async function createCase(data: {
  commodityId: string;
  description: string;
  issueType?: string;
}): Promise<{ case: SupportCase }> {
  return clientFetch('/cases', {
    method: 'POST',
    body: JSON.stringify(data),
    auth: true,
  });
}

export async function fetchMyCases(
  status?: string,
  cursor?: string,
): Promise<{ cases: SupportCase[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (cursor) params.set('cursor', cursor);
  const qs = params.toString();
  return clientFetch(`/cases${qs ? `?${qs}` : ''}`, { auth: true });
}

export async function fetchCase(caseId: string): Promise<{ case: SupportCase }> {
  return clientFetch(`/cases/${caseId}`, { auth: true });
}

export async function sendMessage(
  caseId: string,
  content: string,
  contentType: string = 'text',
): Promise<{ message: CaseMessage }> {
  return clientFetch(`/cases/${caseId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, contentType }),
    auth: true,
  });
}

export async function uploadMedia(
  caseId: string,
  file: File,
): Promise<{ analysisId: string; sourceType: string }> {
  const token = getToken();
  if (!token) {
    clearAuth();
    throw new PortalClientError(401, 'Not authenticated');
  }

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/cases/${caseId}/media`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });

  if (res.status === 401) {
    clearAuth();
    if (typeof window !== 'undefined') window.location.href = '/warranty';
    throw new PortalClientError(401, 'Session expired');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new PortalClientError(res.status, safeErrorMessage(res.status, body.error));
  }

  return res.json();
}

export async function escalateCase(caseId: string): Promise<{ message: string }> {
  return clientFetch(`/cases/${caseId}/escalate`, {
    method: 'POST',
    auth: true,
  });
}

export async function fetchSSEToken(caseId: string): Promise<string> {
  const res = await clientFetch<{ token: string }>(`/cases/${caseId}/sse-token`, {
    method: 'POST',
    auth: true,
  });
  return res.token;
}

export function buildSSEUrl(caseId: string, token: string): string {
  return `${API_BASE}/cases/${caseId}/stream?token=${encodeURIComponent(token)}`;
}

export async function submitCaseFeedback(
  caseId: string,
  resolved: boolean,
): Promise<{ signal: { id: string } }> {
  return clientFetch(`/cases/${caseId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ resolved }),
    auth: true,
  });
}

export async function submitFaqFeedback(
  faqId: string,
  helpful: boolean,
): Promise<{ signal: { id: string } }> {
  return clientFetch(`/faqs/${faqId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ helpful }),
    auth: true,
  });
}

export { PortalClientError };
