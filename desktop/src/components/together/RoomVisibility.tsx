import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Globe } from '../../lib/icons';
import { setRoomPublic } from '../../lib/together/session';
import type { RoomView } from '../../lib/together/types';

export function RoomVisibility({ room, host }: { room: RoomView; host: boolean }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const open = room.public === true;
  if (room.public === undefined || (!host && !open)) return null;

  const toggle = () => {
    setBusy(true);
    setRoomPublic(!open)
      .catch(() => toast.error(t('together.errors.generic')))
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-ink/[0.035] px-2.5 py-2">
      <Globe size={15} className={open ? 'shrink-0 text-accent' : 'shrink-0 text-ink-35'} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-ink-85">
          {t('together.publicRoom')}
        </p>
        <p className="truncate text-[10.5px] text-ink-40">{t('together.publicHint')}</p>
      </div>
      {host && (
        <button
          type="button"
          role="switch"
          aria-checked={open}
          aria-label={t('together.publicRoom')}
          disabled={busy}
          onClick={toggle}
          className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-all duration-200 disabled:cursor-default disabled:opacity-60 ${
            open ? 'bg-accent shadow-[0_0_14px_-2px_var(--color-accent-glow)]' : 'bg-ink/10'
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full shadow-md transition-all duration-200 ${
              open ? 'left-[18px] bg-accent-contrast' : 'left-0.5 bg-white'
            }`}
          />
        </button>
      )}
    </div>
  );
}
