import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Radio } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { roomTitle } from '../../../lib/together/room-rules';
import { useChatListStore } from '../../../stores/chat/list';
import { useChatRoomStore } from '../../../stores/chat/room';
import { useTogetherStore } from '../../../stores/together';
import { unreadLabel } from './mute';

export function useRoomLabel(): string {
  const { t } = useTranslation();
  const title = useTogetherStore((state) => (state.room ? roomTitle(state.room) : null));
  return title ?? t('chat.list.room');
}

export const RoomRow = memo(function RoomRow({
  selected,
  onOpen,
}: {
  selected: boolean;
  onOpen: () => void;
}) {
  const animate = usePerfMode().idleAnim;
  const label = useRoomLabel();
  const code = useChatRoomStore((state) => state.code);
  const conversationId = useChatRoomStore((state) => state.conversationId);
  const unread = useChatListStore((state) =>
    conversationId ? (state.byId[conversationId]?.unread ?? 0) : 0,
  );
  if (!code) return null;

  return (
    <button
      type="button"
      data-ui="chat-row"
      data-kind="room"
      aria-current={selected ? 'true' : undefined}
      onClick={onOpen}
      className="group mx-2 mb-1 flex h-[52px] w-[calc(100%-1rem)] cursor-pointer items-center gap-3 rounded-2xl border px-2.5 text-left transition-colors duration-200 hover:bg-ink/[0.05]"
      style={{
        borderColor: selected ? 'var(--color-accent)' : 'var(--color-accent-glow)',
        background: 'linear-gradient(90deg, var(--color-accent-glow), transparent 70%)',
      }}
    >
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-contrast)]">
        {animate && (
          <span
            aria-hidden
            className="chat-motion absolute inset-0 rounded-full border border-[var(--color-accent)]"
            style={{ animation: 'chat-live 1.8s ease-out infinite' }}
          />
        )}
        <Radio size={16} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-ink-90">{label}</span>
        <span className="block truncate font-mono text-[11px] tracking-wider text-ink-40">
          {code}
        </span>
      </span>
      {unread > 0 && (
        <span className="rounded-full bg-[var(--color-accent)] px-1.5 text-[11px] font-bold leading-5 text-[var(--color-accent-contrast)] tabular-nums">
          {unreadLabel(unread)}
        </span>
      )}
    </button>
  );
});
