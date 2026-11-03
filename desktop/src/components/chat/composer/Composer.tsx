import {
  type ChangeEvent,
  type KeyboardEvent,
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { nowPlayingEmbed } from '../../../lib/chat/embed-snapshot';
import { findChatLinks } from '../../../lib/chat/soundcloud-link';
import { composeRich, sameRich } from '../../../lib/chat/spans';
import { surface } from '../../../lib/chat/tone';
import type { ConvId, Embed, Member, Message, UserRef } from '../../../lib/chat/types';
import { hasLink } from '../../../lib/together/room-rules';
import { useChatStore } from '../../../stores/chat';
import { type Compose, useChatThreadStore } from '../../../stores/chat/thread';
import { findBySeq } from '../../../stores/chat/thread-messages';
import { startEdit } from '../bubbles/message-menu';
import { ComposerEmbeds } from '../embeds/ComposerEmbeds';
import { type PendingEmbed, useLinkEmbeds } from '../embeds/useLinkEmbeds';
import { AttachButton } from '../media/AttachButton';
import { useRoomLinkBlock, useRoomMembers } from '../room/useRoom';
import { useThread } from '../thread/context';
import { toastError } from '../thread/errors';
import { GlassLayer } from '../thread/GlassLayer';
import { canEdit } from '../thread/permissions';
import { ComposerContext } from './ComposerContext';
import { EmojiButton } from './EmojiButton';
import { useTypingPing } from './hooks';
import { LinkHint } from './LinkHint';
import { MentionPopup } from './MentionPopup';
import { NowPlayingButton } from './NowPlayingButton';
import { SendButton } from './SendButton';
import { useComposerText } from './useComposerText';
import { useMentions } from './useMentions';
import { wrapSelection } from './wrap';

const NO_COMPOSE: Compose = { reply: null, edit: null };
const NO_MEMBERS: Member[] = [];
const INPUT_MAX_PX = 168;
const COUNTER_FROM = 200;
const LINKS_SCAN = 16;
const ATTACHED = 'attached:';

function lastEditable(conversationId: ConvId): Message | null {
  const messages = useChatThreadStore.getState().threads[conversationId]?.messages ?? [];
  const now = Date.now();
  for (let i = messages.length - 1; i >= 0; i--) if (canEdit(messages[i], now)) return messages[i];
  return null;
}

function fitHeight(input: HTMLTextAreaElement | null, empty: boolean) {
  if (!input) return;
  input.style.height = 'auto';
  if (!empty) input.style.height = `${Math.min(input.scrollHeight, INPUT_MAX_PX)}px`;
}

export const Composer = memo(function Composer({ conversationId }: { conversationId: ConvId }) {
  const { t, i18n } = useTranslation();
  const { conversation, me } = useThread();
  const compose = useChatThreadStore(
    (state) => state.threads[conversationId]?.compose ?? NO_COMPOSE,
  );
  const ready = useChatThreadStore((state) => state.threads[conversationId]?.load === 'ready');
  const threadMembers = useChatThreadStore(
    (state) => state.threads[conversationId]?.members ?? NO_MEMBERS,
  );
  const roomMembers = useRoomMembers(conversationId);
  const members = roomMembers ?? threadMembers;
  const editing = useChatThreadStore((state) =>
    compose.edit
      ? (state.threads[conversationId]?.messages.find((m) => m.clientId === compose.edit) ?? null)
      : null,
  );
  const replying = useChatThreadStore((state) =>
    compose.reply !== null
      ? findBySeq(state.threads[conversationId]?.messages ?? [], compose.reply)
      : null,
  );
  const limits = useChatStore((state) => state.config?.limits);
  const paused = useChatStore(
    (state) => state.status?.sendPaused === true || state.config?.sendPaused === true,
  );
  const textMax = limits?.textMax ?? 4096;
  const embedsMax = limits?.embedsMax ?? 3;

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const draft = useComposerText(conversationId, ready, compose.edit, inputRef);
  const { text, setText, picks, setPicks } = draft;
  const [embeds, setEmbeds] = useState<Embed[]>([]);
  const [caret, setCaret] = useState(0);
  const groupLike = conversation.kind === 'group' || conversation.kind === 'room';
  const mentions = useMentions(text, caret, members, me, groupLike);
  const links = useLinkEmbeds(text, Math.max(0, embedsMax - embeds.length));
  const present = useMemo(
    () => new Set(findChatLinks(text, LINKS_SCAN).map((link) => link.key)),
    [text],
  );
  const ping = useTypingPing(conversationId);
  const linkBlock = useRoomLinkBlock(conversationId);

  useEffect(() => {
    if (compose.reply !== null) inputRef.current?.focus();
  }, [compose.reply]);

  useLayoutEffect(() => fitHeight(inputRef.current, text === ''), [text]);

  const setComposeState = (change: Partial<Compose>) =>
    useChatThreadStore.getState().setCompose(conversationId, change);
  const fail = (error: unknown) => toastError(error, t, i18n.language);

  const linked = links.items.filter((item) => present.has(item.key));
  const outgoing = [...embeds, ...linked.flatMap((item) => item.embed ?? [])].slice(0, embedsMax);
  const pending: PendingEmbed[] = [
    ...embeds.map((embed) => ({ key: `${ATTACHED}${embed.urn}`, embed, loading: false })),
    ...linked,
  ];
  const rich = composeRich(text, picks);
  const tooLong = rich.text.length > textMax;
  const empty = rich.text.length === 0 && (editing !== null || outgoing.length === 0);
  const linkLocked = linkBlock !== null && hasLink(rich.text);
  const blocked = paused || tooLong || empty || linkLocked;

  const submit = async () => {
    if (blocked) return;
    const store = useChatThreadStore.getState();
    if (editing) {
      if (editing.seq === null) return;
      if (editing.body.type === 'text' && sameRich(editing.body, rich)) {
        setComposeState({ edit: null });
        return;
      }
      await store.edit(conversationId, editing.seq, rich).catch(fail);
      return;
    }
    const before = { text, picks, embeds };
    draft.clear();
    setEmbeds([]);
    try {
      await store.send(conversationId, rich, outgoing);
    } catch (error) {
      fail(error);
      draft.restore(before);
      setEmbeds((list) => (list.length === 0 ? before.embeds : list));
    }
  };

  const pickMention = (user: UserRef) => {
    const query = mentions.query;
    if (!query) return;
    const insert = `@${user.name} `;
    const position = query.start + insert.length;
    setText(text.slice(0, query.start) + insert + text.slice(caret));
    setPicks((list) => [
      ...list.filter((pick) => pick.userId !== user.id),
      { userId: user.id, name: user.name },
    ]);
    setCaret(position);
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(position, position));
  };

  const attachNowPlaying = () => {
    const embed = nowPlayingEmbed();
    if (!embed) return;
    setEmbeds((list) =>
      [...list.filter((item) => item.urn !== embed.urn), embed].slice(-embedsMax),
    );
    inputRef.current?.focus();
  };

  const dismissEmbed = (key: string) => {
    if (key.startsWith(ATTACHED)) {
      setEmbeds((list) => list.filter((embed) => `${ATTACHED}${embed.urn}` !== key));
    } else {
      links.dismiss(key);
    }
  };

  const mentionKey = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (mentions.candidates.length === 0) return false;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      mentions.move(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      pickMention(mentions.candidates[mentions.active]);
    } else if (event.key === 'Escape') {
      mentions.close();
    } else {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || mentionKey(event)) return;
    const mod = event.metaKey || event.ctrlKey;
    if (mod && (event.key === 'b' || event.key === 'i')) {
      event.preventDefault();
      const wrapped = wrapSelection(event.currentTarget, event.key === 'b' ? '**' : '__');
      setText(wrapped.text);
      requestAnimationFrame(() => inputRef.current?.setSelectionRange(wrapped.start, wrapped.end));
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    } else if (event.key === 'ArrowUp' && text === '' && !editing) {
      const last = lastEditable(conversationId);
      if (!last) return;
      event.preventDefault();
      startEdit(last);
    } else if (event.key === 'Escape' && (editing || replying)) {
      event.stopPropagation();
      setComposeState(editing ? { edit: null } : { reply: null });
    }
  };

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    setCaret(event.target.selectionStart);
    mentions.reset();
    if (event.target.value.trim()) ping();
  };

  const target = editing ?? replying;

  return (
    <div data-ui="chat-composer" className="relative shrink-0 px-3 pt-1.5 pb-3">
      <div className="relative mx-auto w-full max-w-[780px]">
        {mentions.candidates.length > 0 && (
          <MentionPopup
            people={mentions.candidates}
            active={mentions.active}
            onPick={pickMention}
          />
        )}
        {target && (
          <ComposerContext
            mode={editing ? 'edit' : 'reply'}
            message={target}
            onCancel={() => setComposeState(editing ? { edit: null } : { reply: null })}
          />
        )}
        {linkLocked && <LinkHint block={linkBlock} />}
        {!editing && pending.length > 0 && (
          <div className="mx-1 mb-1.5">
            <ComposerEmbeds items={pending} onDismiss={dismissEmbed} />
          </div>
        )}
        <div className="relative rounded-[22px] border border-ink/[0.07] transition-colors duration-150 focus-within:border-ink/[0.16]">
          <GlassLayer
            blur={30}
            tint="var(--color-bg-glass)"
            solid={surface(10)}
            className="rounded-[22px]"
          />
          <div className="relative flex items-end gap-1 p-1" style={{ isolation: 'isolate' }}>
            {!editing && <AttachButton conversationId={conversationId} />}
            {!editing && <NowPlayingButton onAttach={attachNowPlaying} />}
            <textarea
              ref={inputRef}
              rows={1}
              value={text}
              onChange={onChange}
              onKeyDown={onKeyDown}
              onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
              placeholder={t(
                paused ? 'chat.thread.composer.paused' : 'chat.thread.composer.placeholder',
              )}
              disabled={paused}
              style={{ outline: 'none' }}
              className="max-h-[168px] min-h-[36px] flex-1 resize-none bg-transparent px-2 py-[8px] text-[13.5px] leading-[1.45] text-ink-92 outline-none placeholder:text-ink-30 disabled:cursor-not-allowed"
            />
            <EmojiButton onFocusInput={() => inputRef.current?.focus()} />
            <SendButton
              editing={editing !== null}
              disabled={blocked}
              onSend={() => void submit()}
            />
          </div>
        </div>
        {text.length > textMax - COUNTER_FROM && (
          <div
            className={`mt-1 pr-3 text-right text-[11px] tabular-nums ${tooLong ? 'text-rose-300' : 'text-ink-35'}`}
          >
            {rich.text.length}/{textMax}
          </div>
        )}
      </div>
    </div>
  );
});
