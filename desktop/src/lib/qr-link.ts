import { fetchWithAuthFallback } from './api-client';
import {
  sealedLinkClaimPull,
  sealedLinkClaimPush,
  sealedLinkCreatePull,
  sealedLinkCreatePush,
  sealedLinkPoll,
} from './chat/login';
import type { LinkMode, LinkState } from './chat/types';

export interface CreateLinkResponse {
  linkRequestId: string;
  claimToken: string;
  expiresAt: number;
  sealed: boolean;
}

export interface LinkStatusResponse {
  status: LinkState;
  mode: LinkMode;
  sessionId?: string | null;
  error?: string | null;
}

export interface ClaimLinkResponse {
  sessionId: string;
  mode: LinkMode;
}

interface PlainLink {
  linkRequestId: string;
  claimToken: string;
  expiresAt: string;
}

export async function createLinkRequest(mode: LinkMode): Promise<CreateLinkResponse> {
  const sealed = await (mode === 'pull' ? sealedLinkCreatePull() : sealedLinkCreatePush());
  if (sealed) {
    return {
      linkRequestId: sealed.linkRequestId,
      claimToken: sealed.claimToken,
      expiresAt: sealed.expiresAt,
      sealed: true,
    };
  }
  const created = await fetchWithAuthFallback<PlainLink>('/auth/link/create', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
  return {
    linkRequestId: created.linkRequestId,
    claimToken: created.claimToken,
    expiresAt: Date.parse(withUtcOffset(created.expiresAt)),
    sealed: false,
  };
}

function withUtcOffset(timestamp: string): string {
  return /(Z|[+-]\d\d:?\d\d)$/i.test(timestamp) ? timestamp : `${timestamp}Z`;
}

export async function claimLinkRequest(
  claimToken: string,
  mode: LinkMode,
): Promise<ClaimLinkResponse> {
  const sealed = await (mode === 'push'
    ? sealedLinkClaimPush(claimToken)
    : sealedLinkClaimPull(claimToken));
  if (sealed) return sealed;
  return fetchWithAuthFallback<ClaimLinkResponse>('/auth/link/claim', {
    method: 'POST',
    body: JSON.stringify({ claimToken }),
  });
}

export async function getLinkStatus(
  link: Pick<CreateLinkResponse, 'linkRequestId' | 'sealed'>,
): Promise<LinkStatusResponse | null> {
  if (link.sealed) return sealedLinkPoll(link.linkRequestId);
  return fetchWithAuthFallback<LinkStatusResponse>(
    `/auth/link/status?id=${encodeURIComponent(link.linkRequestId)}`,
  );
}

export function encodeQrPayload(claimToken: string, mode: LinkMode): string {
  const params = new URLSearchParams({ token: claimToken, mode });
  return `scd://link?${params.toString()}`;
}
