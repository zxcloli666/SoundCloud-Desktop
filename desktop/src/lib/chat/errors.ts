import type { ChatError } from './types';

export function chatError(error: unknown): ChatError | null {
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? (error as ChatError) : null;
}

export function chatErrorKey(error: unknown, area: string, known: ReadonlySet<string>): string {
  const code = chatError(error)?.code;
  return `chat.${area}.errors.${code && known.has(code) ? code : 'generic'}`;
}
