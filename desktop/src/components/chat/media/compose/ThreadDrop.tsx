import { memo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { isImagePath } from '../../../../lib/chat/image-files';
import type { ConversationSummary } from '../../../../lib/chat/types';
import { ImageIcon, Lock } from '../../../../lib/icons';
import { usePerfMode } from '../../../../lib/perf';
import { useChatMediaStore } from '../../../../stores/chat/media';
import { useRoomSendLock } from '../../room/useRoom';
import { isActiveMember, isRequest } from '../../thread/permissions';
import { attachPaths } from './attach';
import { FADE, LIFT } from './motion';
import { useAttachAccess } from './useAttachGate';
import { useImageDrop } from './useImageDrop';
import { useStagedAlbum } from './useStagedAlbum';

type Look = 'open' | 'full' | 'locked' | 'closed' | 'none';

export const ThreadDrop = memo(function ThreadDrop({
  conversation,
}: {
  conversation: ConversationSummary;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const area = useRef<HTMLDivElement>(null);
  const sendLocked = useRoomSendLock(conversation.id) !== null;
  const usable = !isRequest(conversation) && isActiveMember(conversation) && !sendLocked;
  const access = useAttachAccess(conversation, usable);
  const album = useStagedAlbum(conversation.id);
  const full = album.uploads.length + album.preparing >= access.max;
  const { gate, max } = access;
  const conversationId = conversation.id;

  const drop = useCallback(
    (paths: string[]) => {
      const images = paths.filter(isImagePath);
      if (gate === 'hidden' || images.length === 0) return;
      if (gate !== 'open') {
        useChatMediaStore.getState().setNote({ conversationId, gate });
        return;
      }
      void attachPaths(conversationId, images, max);
    },
    [gate, max, conversationId],
  );
  const hover = useImageDrop(area, isImagePath, drop);

  let look: Look = 'none';
  if (hover && gate !== 'hidden') {
    if (hover.images === 0) look = 'none';
    else if (gate === 'locked') look = 'locked';
    else if (gate !== 'open') look = 'closed';
    else look = full ? 'full' : 'open';
    if (hover.images === 0 && hover.other > 0 && gate === 'open') look = 'none';
  }
  const blur = perf.blur(14);
  const accent = look === 'open' || look === 'locked';
  const title = {
    open: t('chat.media.drop.title'),
    full: t('chat.media.drop.full'),
    locked: t('chat.media.drop.locked'),
    closed: t('chat.media.drop.closed'),
    none: '',
  }[look];
  const hint = {
    open: t('chat.media.drop.hint'),
    full: t('chat.media.drop.fullHint'),
    locked: t('chat.media.drop.lockedHint'),
    closed: '',
    none: '',
  }[look];
  const left = Math.max(0, max - album.uploads.length - album.preparing);

  return (
    <div ref={area} className="pointer-events-none absolute inset-0 z-[45]">
      {look !== 'none' && hover && (
        <div
          data-ui="chat-drop"
          data-look={look}
          className={`absolute inset-0 flex items-center justify-center p-4 ${FADE}`}
          style={{
            background: blur ? 'rgb(var(--paper) / 0.6)' : 'rgb(var(--paper) / 0.9)',
            backdropFilter: blur ? `blur(${blur}px) saturate(1.3)` : undefined,
            WebkitBackdropFilter: blur ? `blur(${blur}px) saturate(1.3)` : undefined,
          }}
        >
          <div
            className="absolute inset-3 rounded-[24px] border-2 border-dashed"
            style={{
              borderColor: accent ? 'var(--color-accent)' : 'rgb(var(--ink) / 0.22)',
              background: accent
                ? 'radial-gradient(55% 55% at 50% 50%, var(--color-accent-glow), transparent 72%)'
                : undefined,
            }}
          />
          <div className="relative flex flex-col items-center text-center">
            <DropStack
              count={Math.min(hover.images, 3)}
              accent={accent}
              locked={look === 'locked'}
              idle={perf.idleAnim}
            />
            <div className="mt-5 text-[18px] font-semibold tracking-tight text-ink-95">{title}</div>
            {hint && <div className="mt-1 max-w-[300px] text-[12.5px] text-ink-55">{hint}</div>}
            {look === 'open' && (
              <div
                className="mt-3 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold tabular-nums"
                style={{
                  borderColor: 'var(--color-accent-glow)',
                  color: 'var(--color-accent-hover)',
                }}
              >
                {Math.min(hover.images, left)}/{left}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

function DropStack({
  count,
  accent,
  locked,
  idle,
}: {
  count: number;
  accent: boolean;
  locked: boolean;
  idle: boolean;
}) {
  const cards = Array.from({ length: Math.max(1, count) }, (_, index) => index);
  return (
    <span className="relative flex size-[84px] items-center justify-center">
      {cards.map((index) => (
        <span
          key={index}
          className={`absolute flex size-[64px] items-center justify-center rounded-[18px] border ${LIFT}`}
          style={{
            transform: `rotate(${(index - (cards.length - 1) / 2) * 9}deg) translateY(${index * -3}px)`,
            background: accent ? 'var(--color-accent-glow)' : 'rgb(var(--ink) / 0.07)',
            borderColor: accent ? 'var(--color-accent)' : 'rgb(var(--ink) / 0.14)',
            color: accent ? 'var(--color-accent-hover)' : 'rgb(var(--ink) / 0.5)',
          }}
        >
          {index === cards.length - 1 && (locked ? <Lock size={24} /> : <ImageIcon size={26} />)}
        </span>
      ))}
      {idle && accent && (
        <span
          className="absolute inset-0 animate-ping rounded-[24px] opacity-25 motion-reduce:animate-none"
          style={{ background: 'var(--color-accent-glow)' }}
        />
      )}
    </span>
  );
}
