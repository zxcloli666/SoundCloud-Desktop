import { type RefObject, useEffect, useRef, useState } from 'react';
import { type MentionPick, mentionPicks, toComposerText } from '../../../lib/chat/spans';
import type { ClientId, ConvId } from '../../../lib/chat/types';
import { useChatThreadStore } from '../../../stores/chat/thread';
import { useDraftSaver } from './hooks';

interface Stash {
  text: string;
  picks: MentionPick[];
}

function focusEnd(input: HTMLTextAreaElement | null) {
  requestAnimationFrame(() => {
    if (!input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });
}

export function useComposerText(
  conversationId: ConvId,
  ready: boolean,
  editId: ClientId | null,
  input: RefObject<HTMLTextAreaElement | null>,
) {
  const [text, setText] = useState('');
  const [picks, setPicks] = useState<MentionPick[]>([]);
  const current = useRef<Stash>({ text, picks });
  current.current = { text, picks };
  const stash = useRef<Stash | null>(null);
  const markSaved = useDraftSaver(conversationId, text, picks, ready && editId === null);

  useEffect(() => {
    if (!ready || current.current.text) return;
    const draft = useChatThreadStore.getState().threads[conversationId]?.draft;
    if (!draft) return;
    const value = toComposerText(draft);
    markSaved(value);
    setText(value);
    setPicks(mentionPicks(draft));
  }, [ready, conversationId, markSaved]);

  useEffect(() => {
    if (editId) {
      const messages = useChatThreadStore.getState().threads[conversationId]?.messages ?? [];
      const target = messages.find((message) => message.clientId === editId);
      if (!target || target.body.type !== 'text') return;
      stash.current ??= current.current;
      setText(toComposerText(target.body));
      setPicks(mentionPicks(target.body));
      focusEnd(input.current);
      return;
    }
    const saved = stash.current;
    if (!saved) return;
    stash.current = null;
    setText(saved.text);
    setPicks(saved.picks);
  }, [editId, conversationId, input]);

  const clear = () => {
    setText('');
    setPicks([]);
  };

  const restore = (saved: Stash) => {
    if (current.current.text) return;
    setText(saved.text);
    setPicks(saved.picks);
  };

  return { text, setText, picks, setPicks, clear, restore, current };
}
