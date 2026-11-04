import { useTranslation } from 'react-i18next';
import { type RoomCrossfade, useSettingsStore } from '../../stores/settings';

const CROSSFADE_MODES: RoomCrossfade[] = ['mine', 'room'];

export function CrossfadeChoice() {
  const { t } = useTranslation();
  const mode = useSettingsStore((s) => s.roomCrossfade);
  const setMode = useSettingsStore((s) => s.setRoomCrossfade);
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-35">
        {t('together.crossfade')}
      </p>
      <div className="flex rounded-lg bg-ink/[0.05] p-0.5">
        {CROSSFADE_MODES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`cursor-pointer rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-all duration-200 ${
              mode === value ? 'bg-ink/[0.14] text-white' : 'text-ink-45 hover:text-ink-70'
            }`}
          >
            {t(value === 'mine' ? 'together.crossfadeMine' : 'together.crossfadeRoom')}
          </button>
        ))}
      </div>
    </div>
  );
}
