import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageIcon, Lock, Pause } from '../../../lib/icons';
import { isMac } from '../../../lib/platform';
import { shortcutLabel } from './compose/failure';
import { GateNote } from './compose/GateNote';
import { StarPreview } from './compose/StarPreview';
import type { ComposerMedia } from './compose/useComposerMedia';

export const AttachButton = memo(function AttachButton({ media }: { media: ComposerMedia }) {
  const { t } = useTranslation();
  const { gate, max } = media.access;
  if (gate === 'hidden') return null;
  const full = media.album.uploads.length + media.album.preparing >= max;
  const label = `${t('chat.media.attach.title')} (${shortcutLabel(isMac())})`;
  const Badge = gate === 'paused' ? Pause : gate === 'open' ? null : Lock;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        data-ui="chat-attach"
        data-gate={gate}
        aria-label={label}
        title={full && gate === 'open' ? t('chat.media.compose.full') : label}
        aria-haspopup={gate === 'open' ? undefined : 'dialog'}
        aria-disabled={full && gate === 'open' ? true : undefined}
        onClick={full && gate === 'open' ? undefined : media.pick}
        className="relative flex size-9 cursor-pointer items-center justify-center rounded-full text-ink-50 transition-[color,background-color,transform] duration-150 hover:bg-ink/[0.07] hover:text-ink-90 active:scale-95"
      >
        <ImageIcon size={18} />
        {full && gate === 'open' && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] rounded-full px-1 font-mono text-[9.5px] font-bold leading-4 tabular-nums"
            style={{ background: 'var(--color-accent)', color: 'var(--color-accent-contrast)' }}
          >
            {max}
          </span>
        )}
        {Badge && (
          <span
            className="absolute right-1 bottom-1 flex size-[14px] items-center justify-center rounded-full"
            style={{
              background: gate === 'paused' ? 'rgb(var(--ink) / 0.18)' : 'var(--color-accent)',
              color: gate === 'paused' ? 'rgb(var(--ink) / 0.8)' : 'var(--color-accent-contrast)',
            }}
          >
            <Badge size={8} strokeWidth={3} />
          </span>
        )}
      </button>
      {media.note === 'locked' && <StarPreview onClose={media.closeNote} />}
      {media.note && media.note !== 'locked' && (
        <GateNote gate={media.note} host={media.access.roomHost} onClose={media.closeNote} />
      )}
    </div>
  );
});
