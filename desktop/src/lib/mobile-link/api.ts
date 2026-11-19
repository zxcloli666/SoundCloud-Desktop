import { ApiError, apiRequest } from '../api-client';

export type LinkStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'account_mismatch';

export interface MobileAccess {
  available: boolean;
  linked: boolean;
  status: 'active' | 'relink_required';
  plan: string | null;
  planSeenAt: string | null;
  uqOptIn: boolean;
}

export interface LinkAccount {
  username: string;
  avatarUrl: string | null;
}

export interface LinkRequest {
  id: string;
  url: string;
  account: LinkAccount;
}

export interface AuthCallback {
  code: string;
  state: string;
}

export const MOBILE_ACCESS_KEY = ['mobile-access'] as const;

export async function fetchMobileAccess(): Promise<MobileAccess | null> {
  try {
    return await apiRequest<MobileAccess>('/me/mobile', { silentStatuses: [403, 404] });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return null;
    throw e;
  }
}

export function beginLink(): Promise<LinkRequest> {
  return apiRequest<LinkRequest>('/auth/mobile/link', { method: 'POST' });
}

export function submitCallback(id: string, callback: AuthCallback): Promise<void> {
  return apiRequest<void>('/auth/mobile/link/callback', {
    method: 'POST',
    body: JSON.stringify({ id, ...callback }),
  });
}

export async function fetchLinkStatus(id: string): Promise<LinkStatus> {
  const res = await apiRequest<{ status: LinkStatus }>(
    `/auth/mobile/link/status?id=${encodeURIComponent(id)}`,
    { quiet: true },
  );
  return res.status;
}

export function unlinkMobile(): Promise<void> {
  return apiRequest<void>('/auth/mobile', { method: 'DELETE' });
}
