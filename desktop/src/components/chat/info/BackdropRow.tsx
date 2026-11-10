import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Hourglass } from '../../../lib/chat/icons';
import { ChevronRight, EyeOff, ImageIcon, Lock, Star } from '../../../lib/icons';
import { lookKey, selectHidden, useBackdropStore } from '../../../stores/chat/backdrop';
import { presetOf } from '../backdrop/presets';
import type { BackdropAccess } from '../backdrop/target';
import { useBackdropAccess } from '../backdrop/useChatTarget';
import { useThread } from '../thread/context';

function Swatch({ tile, hidden }: { tile: string | null; hidden: boolean }) {
  return (
    <span className="relative h-6 w-10 shrink-0 overflow-hidden rounded-md bg-ink/[0.06] ring-1 ring-ink/10">
      {tile && (
        <img
          src={tile}
          alt=""
          draggable={false}
          className={`absolute inset-0 h-full w-full object-cover ${hidden ? 'opacity-30' : ''}`}
        />
      )}
      {(hidden || !tile) && (
        <span className="absolute inset-0 flex items-center justify-center text-ink-55">
          {hidden ? <EyeOff size={11} /> : <ImageIcon size={11} />}
        </span>
      )}
    </span>
  );
}

function Mark({ access }: { access: BackdropAccess }) {
  if (access === 'role') return <Lock size={13} className="shrink-0 text-ink-35" />;
  if (access === 'pending') return <Hourglass size={13} className="shrink-0 text-ink-35" />;
  if (access === 'star') {
    return <Star size={12} fill="currentColor" className="shrink-0 text-accent" />;
  }
  return null;
}

export const BackdropRow = memo(function BackdropRow() {
  const { t } = useTranslation();
  const { conversation } = useThread();
  const access = useBackdropAccess(conversation);
  const backdrop = conversation.backdrop;
  const hidden = useBackdropStore(selectHidden(conversation.id, lookKey(backdrop)));
  const open = useBackdropStore((state) => state.open);
  const preset = presetOf(backdrop?.kind === 'preset' ? backdrop.id : null);
  const closed = access === 'role' || access === 'pending';

  return (
    <button
      type="button"
      data-ui="chat-info-backdrop"
      data-access={access}
      aria-busy={access === 'loading'}
      onClick={() => open('picker', conversation.id)}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-2xl border border-ink/[0.06] bg-ink/[0.025] px-3 py-2.5 text-left outline-none transition-colors duration-150 hover:bg-ink/[0.045] focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-ink/[0.06] text-ink-60">
        <ImageIcon size={14} />
      </span>
      <span
        className={`flex-1 text-[13px] font-semibold ${closed ? 'text-ink-50' : 'text-ink-85'}`}
      >
        {t('chat.backdrop.title')}
      </span>
      {backdrop && <Swatch tile={preset?.tile ?? null} hidden={hidden} />}
      <Mark access={access} />
      {!closed && <ChevronRight size={14} className="shrink-0 text-ink-30" />}
    </button>
  );
});
