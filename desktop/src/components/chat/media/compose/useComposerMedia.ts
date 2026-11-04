import { type ClipboardEvent, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConversationSummary } from '../../../../lib/chat/types';
import { type MediaNote, useChatMediaStore } from '../../../../stores/chat/media';
import { toastError } from '../../thread/errors';
import { removeAlbum } from './album-cancel';
import { clipboardImages, pasteImages, pickImages } from './pick';
import { type AttachAccess, useAttachAccess } from './useAttachGate';
import { type StagedAlbum, useStagedAlbum } from './useStagedAlbum';

export type NoteGate = MediaNote;

export interface ComposerMedia {
  access: AttachAccess;
  album: StagedAlbum;
  note: NoteGate | null;
  ready: boolean;
  pick: () => void;
  add: () => void;
  closeNote: () => void;
  paste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  cancel: () => void;
  fail: (error: unknown) => void;
}

export function useComposerMedia(
  conversation: ConversationSummary,
  focus: () => void,
): ComposerMedia {
  const { t, i18n } = useTranslation();
  const access = useAttachAccess(conversation);
  const album = useStagedAlbum(conversation.id);
  const conversationId = conversation.id;
  const note = useChatMediaStore((state) =>
    state.note?.conversationId === conversationId ? state.note.gate : null,
  );
  const { gate, max } = access;

  const fail = useCallback(
    (error: unknown) => toastError(error, t, i18n.language),
    [t, i18n.language],
  );
  const add = useCallback(() => {
    pickImages(conversationId, max, t('chat.media.attach.title'), focus).catch(fail);
  }, [conversationId, max, t, fail, focus]);
  const full = album.uploads.length + album.preparing >= max;
  const pick = useCallback(() => {
    if (gate === 'hidden' || (gate === 'open' && full)) return;
    if (gate !== 'open') {
      const shown = useChatMediaStore.getState().note;
      useChatMediaStore
        .getState()
        .setNote(shown?.conversationId === conversationId ? null : { conversationId, gate });
      return;
    }
    add();
  }, [gate, add, conversationId, full]);
  const closeNote = useCallback(() => useChatMediaStore.getState().setNote(null), []);
  const paste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const files = clipboardImages(event.clipboardData);
      if (files.length === 0 || gate === 'hidden') return;
      event.preventDefault();
      if (gate !== 'open') {
        useChatMediaStore.getState().setNote({ conversationId, gate });
        return;
      }
      pasteImages(conversationId, files, max).catch(fail);
    },
    [conversationId, gate, max, fail],
  );
  const albumId = album.id;
  const preparing = album.preparing > 0;
  const cancel = useCallback(() => {
    if (!albumId || preparing) return;
    removeAlbum(albumId, t, fail);
  }, [albumId, preparing, t, fail]);

  useEffect(
    () => () => {
      if (useChatMediaStore.getState().note?.conversationId === conversationId) {
        useChatMediaStore.getState().setNote(null);
      }
    },
    [conversationId],
  );

  const ready = album.uploads.length > 0 && album.preparing === 0;

  return useMemo(
    () => ({ access, album, note, ready, pick, add, closeNote, paste, cancel, fail }),
    [access, album, note, ready, pick, add, closeNote, paste, cancel, fail],
  );
}
