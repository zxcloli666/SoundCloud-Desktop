import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal } from '../../../lib/icons';
import type { RoomView } from '../../../lib/together/types';
import { CrossfadeChoice } from '../../together/CrossfadeChoice';
import { BackdropEntry } from './BackdropEntry';
import { RoomCapacity } from './RoomCapacity';
import { RoomPopover } from './RoomPopover';

export const RoomTuning = memo(function RoomTuning({ room }: { room: RoomView }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <RoomPopover
      open={open}
      onOpenChange={setOpen}
      width={260}
      trigger={
        <button
          type="button"
          title={t('together.crossfade')}
          aria-label={t('together.crossfade')}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-45 transition-colors hover:bg-ink/[0.08] hover:text-ink-90"
        >
          <SlidersHorizontal size={13} />
        </button>
      }
    >
      <div className="py-1.5">
        <CrossfadeChoice />
        <RoomCapacity room={room} />
        <BackdropEntry room={room} />
      </div>
    </RoomPopover>
  );
});
