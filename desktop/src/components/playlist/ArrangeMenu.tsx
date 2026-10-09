import * as Popover from '@radix-ui/react-popover';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownAZ, ArrowUpDown, Clock, User } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import { ARRANGE_MODES, type ArrangeMode } from '../../lib/track-order';

const MODE_ICONS: Record<ArrangeMode, React.ReactNode> = {
  reverse: <ArrowUpDown size={14} />,
  title: <ArrowDownAZ size={14} />,
  artist: <User size={14} />,
  duration: <Clock size={14} />,
};

export const ArrangeMenu = React.memo(function ArrangeMenu({
  disabled,
  onArrange,
}: {
  disabled: boolean;
  onArrange: (mode: ArrangeMode) => void;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const [open, setOpen] = useState(false);
  const b = perf.blur(30);
  const label = disabled ? t('playlist.arrangeWait') : t('playlist.arrange');

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={label}
          aria-label={label}
          className={`inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-35 ${
            open
              ? 'text-white/95 bg-white/[0.09]'
              : 'text-white/55 hover:text-white/95 hover:bg-white/[0.07]'
          }`}
        >
          <ArrowUpDown size={16} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="end"
          className="z-50 w-[230px] rounded-2xl p-1.5 outline-none animate-fade-in"
          style={{
            background: b > 0 ? 'rgba(18,18,22,0.88)' : 'rgb(22,22,26)',
            backdropFilter: b > 0 ? `blur(${b}px) saturate(1.8)` : undefined,
            WebkitBackdropFilter: b > 0 ? `blur(${b}px) saturate(1.8)` : undefined,
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          <p className="px-3 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
            {t('playlist.arrange')}
          </p>
          {ARRANGE_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setOpen(false);
                onArrange(mode);
              }}
              className="group flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-[12.5px] font-medium text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white/92"
            >
              <span className="text-white/35 transition-colors group-hover:text-accent">
                {MODE_ICONS[mode]}
              </span>
              {t(`playlist.arrange_${mode}`)}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
