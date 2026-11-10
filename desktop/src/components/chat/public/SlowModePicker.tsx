import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Timer } from '../../../lib/chat/icons';
import { ink } from '../../../lib/chat/tone';
import { PUBLIC_SLOW_MODE_SECONDS } from '../../../lib/chat/types';
import { useThread } from '../thread/context';
import { setSlowMode } from './actions';
import { slowShort } from './SlowModeChip';

export const SlowModePicker = memo(function SlowModePicker() {
  const { t } = useTranslation();
  const { conversation } = useThread();
  const current = conversation.slowModeS;

  return (
    <section
      data-ui="chat-public-slow-picker"
      className="rounded-2xl border border-ink/[0.06] bg-ink/[0.025] p-3"
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className="flex size-7 items-center justify-center rounded-full"
          style={
            current > 0
              ? { background: 'var(--color-accent-glow)', color: 'var(--color-accent-hover)' }
              : { background: ink(6), color: ink(50) }
          }
        >
          <Timer size={14} />
        </span>
        <span className="flex-1 text-[13px] font-semibold text-ink-85">
          {t('chat.public.slow.title')}
        </span>
      </div>
      <div role="radiogroup" className="grid grid-cols-7 gap-1 rounded-xl bg-shade-25 p-1">
        {PUBLIC_SLOW_MODE_SECONDS.map((seconds) => {
          const active = current === seconds;
          return (
            <button
              key={seconds}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                if (!active) void setSlowMode(conversation.id, seconds);
              }}
              className={`h-8 cursor-pointer rounded-lg text-[11.5px] font-semibold tabular-nums transition-colors duration-150 ${
                active ? 'text-ink' : 'text-ink-50 hover:bg-ink/[0.05] hover:text-ink-80'
              }`}
              style={
                active
                  ? {
                      background: seconds ? 'var(--color-accent)' : ink(12),
                      color: seconds ? 'var(--color-accent-contrast)' : undefined,
                    }
                  : undefined
              }
            >
              {seconds ? slowShort(seconds, t) : t('chat.public.slow.off')}
            </button>
          );
        })}
      </div>
    </section>
  );
});
