import * as Popover from '@radix-ui/react-popover';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentTime } from '../../lib/audio';
import { durLong } from '../../lib/formatters';
import { SmilePlus } from '../../lib/icons';
import { useMobileButtons } from '../../lib/mobile-actions';
import { useMoments } from '../../lib/moment-reactions';
import { reactAt, useReactionValues } from '../../lib/moment-reactions-sync';

export const MomentReactionPicker = React.memo(function MomentReactionPicker({
  trackUrn,
  isCurrent,
}: {
  trackUrn: string;
  isCurrent: boolean;
}) {
  const { t } = useTranslation();
  const visible = useMobileButtons();
  const values = useReactionValues();
  const moments = useMoments(trackUrn);
  const [open, setOpen] = useState(false);
  const [second, setSecond] = useState(0);
  if (!visible || values.length === 0) return null;
  const own = moments.get(second)?.own ?? null;
  const label = t(isCurrent ? 'mobileActions.momentReaction' : 'mobileActions.momentReactionIdle');

  const toggle = (next: boolean) => {
    if (next) setSecond(Math.floor(getCurrentTime()));
    setOpen(next);
  };

  const pick = (valueUrn: string) => {
    void reactAt(trackUrn, second, valueUrn);
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={toggle}>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-ui="moment-reaction"
          disabled={!isCurrent}
          title={label}
          aria-label={label}
          className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-ink-60 hover:text-ink-95 hover:bg-ink/[0.07] data-[state=open]:text-accent data-[state=open]:bg-accent/15 disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-ink-60 disabled:cursor-default transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer"
        >
          <SmilePlus size={16} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={8}
          collisionPadding={12}
          className="z-[200] flex items-center gap-1 rounded-2xl p-1.5 outline-none data-[state=open]:animate-fade-in-up"
          style={{
            background: 'rgb(var(--surface-hi) / 0.96)',
            border: '0.5px solid rgb(var(--ink) / 0.12)',
            boxShadow: '0 16px 40px rgb(var(--shade) / calc(0.5 * var(--shade-alpha)))',
          }}
        >
          <span className="px-2 text-[11px] font-semibold tabular-nums text-ink-45">
            {durLong(second * 1000)}
          </span>
          {values.map((value) => (
            <button
              key={value.valueUrn}
              type="button"
              aria-pressed={own === value.valueUrn}
              aria-label={value.emoji}
              onClick={() => pick(value.valueUrn)}
              className={`w-10 h-10 rounded-xl text-[20px] leading-none cursor-pointer transition-all duration-200 ease-[var(--ease-apple)] hover:scale-110 active:scale-95 ${
                own === value.valueUrn
                  ? 'bg-accent/25 ring-1 ring-accent/60'
                  : 'hover:bg-ink/[0.07]'
              }`}
            >
              {value.emoji}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
