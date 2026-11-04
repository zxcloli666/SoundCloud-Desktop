import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Timer } from '../../../lib/chat/icons';
import { ttlShort } from '../../../lib/chat/render';
import { ink } from '../../../lib/chat/tone';
import { DISAPPEARING_TTLS } from '../../../lib/chat/types';
import { Lock } from '../../../lib/icons';
import { useThread } from '../thread/context';
import { toastError } from '../thread/errors';
import { canSetTimer } from '../thread/permissions';
import { chooseTimer } from '../thread/thread-menu';

const CHOICES: (number | null)[] = [null, ...DISAPPEARING_TTLS];

export const TimerPicker = memo(function TimerPicker() {
  const { t, i18n } = useTranslation();
  const { conversation } = useThread();
  const editable = canSetTimer(conversation);
  const current = conversation.ttlS ?? null;

  return (
    <section className="rounded-2xl border border-ink/[0.06] bg-ink/[0.025] p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className="flex size-7 items-center justify-center rounded-full"
          style={
            current
              ? { background: 'var(--color-accent-glow)', color: 'var(--color-accent-hover)' }
              : { background: ink(6), color: ink(50) }
          }
        >
          <Timer size={14} />
        </span>
        <span className="flex-1 text-[13px] font-semibold text-ink-85">
          {t('chat.thread.timer.title')}
        </span>
        {!editable && <Lock size={12} className="text-ink-30" />}
      </div>
      <div role="radiogroup" className="grid grid-cols-4 gap-1 rounded-xl bg-shade-25 p-1">
        {CHOICES.map((ttlS) => {
          const active = current === ttlS;
          return (
            <button
              key={ttlS ?? 'off'}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!editable}
              onClick={() =>
                void chooseTimer(conversation, ttlS).catch((error) =>
                  toastError(error, t, i18n.language),
                )
              }
              className={`h-8 cursor-pointer rounded-lg text-[12px] font-semibold tabular-nums transition-colors duration-150 disabled:cursor-default ${
                active
                  ? 'text-ink'
                  : 'text-ink-50 enabled:hover:bg-ink/[0.05] enabled:hover:text-ink-80'
              }`}
              style={
                active
                  ? {
                      background: ttlS ? 'var(--color-accent)' : ink(12),
                      color: ttlS ? 'var(--color-accent-contrast)' : undefined,
                    }
                  : undefined
              }
            >
              {ttlS ? ttlShort(ttlS, t) : t('chat.thread.ttl.off')}
            </button>
          );
        })}
      </div>
    </section>
  );
});
