import * as Popover from '@radix-ui/react-popover';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, Loader2 } from '../../../lib/icons';
import type { Track } from '../../../stores/player';
import { Avatar } from '../../ui/Avatar';
import { type BlockTarget, trackTargets } from './targets';
import { useBlockToggle } from './useBlockToggle';

const TargetRow = memo(({ target }: { target: BlockTarget }) => {
  const { t } = useTranslation();
  const { blocked, busy, toggle } = useBlockToggle(target);
  return (
    <div className="flex items-center gap-3 rounded-[14px] px-2 py-2 transition-colors hover:bg-white/[0.04]">
      <Avatar src={target.avatar_url} alt={target.name} size={34} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-white/85">{target.name}</p>
        <p className="text-[10.5px] uppercase tracking-[0.08em] text-white/30">
          {target.kind === 'artist' ? t('blocklist.kindArtist') : t('blocklist.kindUser')}
        </p>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={blocked}
        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border-[0.5px] px-3 text-[11.5px] font-semibold transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-60 ${
          blocked
            ? 'border-white/[0.10] bg-white/[0.05] text-white/60 hover:text-white'
            : 'border-rose-400/30 bg-rose-500/[0.12] text-rose-300 hover:bg-rose-500/20 hover:text-rose-200'
        }`}
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : !blocked && <Ban size={12} />}
        {blocked ? t('blocklist.unblock') : t('blocklist.block')}
      </button>
    </div>
  );
});

export const PlayerBlockButton = memo(({ track }: { track: Track | null | undefined }) => {
  const { t } = useTranslation();
  const targets = useMemo(() => (track ? trackTargets(track) : []), [track]);
  if (targets.length === 0) return null;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          title={t('blocklist.playerTitle')}
          aria-label={t('blocklist.playerTitle')}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 cursor-pointer text-white/30 hover:text-rose-300 hover:bg-white/[0.04] data-[state=open]:text-rose-300 data-[state=open]:bg-white/[0.06]"
        >
          <Ban size={16} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={10}
          collisionPadding={12}
          className="z-[200] w-[300px] origin-bottom-right rounded-[18px] border border-white/[0.10] bg-[#101012]/96 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl outline-none data-[state=open]:animate-fade-in-up"
        >
          <div className="absolute inset-x-0 top-0 h-12 rounded-t-[18px] bg-gradient-to-b from-rose-500/[0.07] to-transparent pointer-events-none" />
          <div className="relative flex items-start gap-2 px-1 pb-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-rose-400/20 bg-rose-500/[0.08] text-rose-300">
              <Ban size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/65">
                {t('blocklist.playerTitle')}
              </p>
              <p className="text-[10.5px] leading-snug text-white/30">
                {t('blocklist.playerHint')}
              </p>
            </div>
          </div>
          <div className="relative space-y-0.5">
            {targets.map((target) => (
              <TargetRow key={`${target.kind}:${target.id}`} target={target} />
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
