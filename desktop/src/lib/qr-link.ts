import { fetchWithAuthFallback } from './api-client';

/**
 * QR-link API — single-use токен для переноса сессии между устройствами.
 *
 * pull: caller (без сессии) показывает QR, другое (залогиненное) сканирует и пушит.
 * push: caller (залогинен) показывает QR, другое (без сессии) сканирует и забирает.
 *
 * Результат claim'а в обе стороны — новая сессия на устройстве, у которого её не было.
 */

export interface CreateLinkResponse {
  linkRequestId: string;
  claimToken: string;
  expiresAt: string;
}

export interface LinkStatusResponse {
  status: 'pending' | 'claimed' | 'failed' | 'expired';
  mode: 'pull' | 'push';
  sessionId?: string;
  error?: string;
}

export interface ClaimLinkResponse {
  sessionId: string;
  mode: 'pull' | 'push';
}

export async function createLinkRequest(mode: 'pull' | 'push'): Promise<CreateLinkResponse> {
  const created = await fetchWithAuthFallback<CreateLinkResponse>('/auth/link/create', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
  return { ...created, expiresAt: withUtcOffset(created.expiresAt) };
}

function withUtcOffset(timestamp: string): string {
  return /(Z|[+-]\d\d:?\d\d)$/i.test(timestamp) ? timestamp : `${timestamp}Z`;
}

export async function claimLinkRequest(claimToken: string): Promise<ClaimLinkResponse> {
  return fetchWithAuthFallback<ClaimLinkResponse>('/auth/link/claim', {
    method: 'POST',
    body: JSON.stringify({ claimToken }),
  });
}

export async function getLinkStatus(linkRequestId: string): Promise<LinkStatusResponse> {
  return fetchWithAuthFallback<LinkStatusResponse>(
    `/auth/link/status?id=${encodeURIComponent(linkRequestId)}`,
  );
}

/**
 * Encoded payload для QR. Это deep-link с claimToken, чтобы мобильный клиент
 * мог автоматически открыть приложение и заклеймить.
 *
 * Формат: scd://link?token=<claimToken>&mode=<pull|push>
 *
 * Мобильное приложение должно:
 *  1. Парсить URL.
 *  2. Если mode=pull (десктоп ждёт сессию) — отправить POST /auth/link/claim со
 *     своим x-session-id и claimToken; если получится — показать "успешно".
 *  3. Если mode=push (десктоп отдаёт свою сессию) — отправить POST /auth/link/claim
 *     БЕЗ x-session-id, бэк вернёт sessionId — сохранить локально и юзер залогинен.
 */
export function encodeQrPayload(claimToken: string, mode: 'pull' | 'push'): string {
  const params = new URLSearchParams({ token: claimToken, mode });
  return `scd://link?${params.toString()}`;
}
