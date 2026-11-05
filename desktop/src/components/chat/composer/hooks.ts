import { useCallback, useEffect, useRef } from 'react';
import { chatBridge } from '../../../lib/chat/bridge';
import { composeRich, type MentionPick } from '../../../lib/chat/spans';
import type { ConvId } from '../../../lib/chat/types';

const DRAFT_MS = 800;
const TYPING_MS = 4_000;

function saveDraft(conversationId: ConvId, text: string, picks: MentionPick[]) {
  const rich = text.trim() ? composeRich(text, picks) : null;
  void chatBridge.draftSave(conversationId, rich).catch(() => undefined);
}

export function useDraftSaver(
  conversationId: ConvId,
  text: string,
  picks: MentionPick[],
  enabled: boolean,
) {
  const saved = useRef(text);
  const pending = useRef<{ text: string; picks: MentionPick[] } | null>(null);

  useEffect(() => {
    if (!enabled || text === saved.current) {
      pending.current = null;
      return;
    }
    pending.current = { text, picks };
    const timer = setTimeout(() => {
      saved.current = text;
      pending.current = null;
      saveDraft(conversationId, text, picks);
    }, DRAFT_MS);
    return () => clearTimeout(timer);
  }, [conversationId, text, picks, enabled]);

  useEffect(
    () => () => {
      if (pending.current) saveDraft(conversationId, pending.current.text, pending.current.picks);
    },
    [conversationId],
  );

  return useCallback((value: string) => {
    saved.current = value;
  }, []);
}

export function useTypingPing(conversationId: ConvId) {
  const last = useRef(0);
  return useCallback(() => {
    const now = Date.now();
    if (now - last.current < TYPING_MS) return;
    last.current = now;
    void chatBridge.typing(conversationId).catch(() => undefined);
  }, [conversationId]);
}
