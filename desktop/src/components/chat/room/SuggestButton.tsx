import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListPlus } from '../../../lib/icons';
import { suggestTrack } from '../../../lib/together/room-actions';
import type { Track } from '../../../stores/player';
import { RoomPopover } from './RoomPopover';
import { SuggestSearch } from './SuggestSearch';

const COOLDOWN_S = 10;

export const SuggestButton = memo(function SuggestButton({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait(wait - 1), 1_000);
    return () => clearTimeout(timer);
  }, [wait]);

  const pick = (track: Track) => {
    setOpen(false);
    void suggestTrack(track).then((sent) => sent && setWait(COOLDOWN_S));
  };

  const label =
    wait > 0 ? t('chat.room.suggest.wait', { value: wait }) : t('chat.room.suggest.button');
  return (
    <RoomPopover
      open={open}
      onOpenChange={setOpen}
      width={300}
      trigger={
        <button
          type="button"
          title={label}
          aria-label={label}
          disabled={disabled || wait > 0}
          className="flex w-[54px] shrink-0 cursor-pointer flex-col items-center gap-1 rounded-xl py-1 text-ink-55 transition-colors enabled:hover:bg-ink/[0.05] enabled:hover:text-white disabled:cursor-default disabled:opacity-60"
        >
          <span className="flex size-9 items-center justify-center rounded-full border border-dashed border-ink/20 tabular-nums">
            {wait > 0 ? (
              <span className="text-[12px] font-semibold">{wait}</span>
            ) : (
              <ListPlus size={15} />
            )}
          </span>
          <span className="w-full truncate px-0.5 text-center text-[10.5px] font-medium">
            {t('chat.room.suggest.short')}
          </span>
        </button>
      }
    >
      <SuggestSearch onPick={pick} />
    </RoomPopover>
  );
});
