import { useTranslation } from 'react-i18next';
import { Sparkles } from '../../../lib/icons';
import { useSettingsStore } from '../../../stores/settings';
import { Toggle } from '../../settings/primitives';

export function AutoplayRow() {
  const { t } = useTranslation();
  const autoplay = useSettingsStore((s) => s.autoplay);
  const setAutoplay = useSettingsStore((s) => s.setAutoplay);

  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.06] px-3 py-2.5">
      <div
        className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center transition-colors duration-200 ${
          autoplay ? 'text-accent bg-accent/15' : 'text-white/25 bg-white/[0.04]'
        }`}
      >
        <Sparkles size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium text-white/80">{t('player.autoplay')}</p>
        <p className="text-[11px] text-white/35 leading-snug">
          {autoplay ? t('player.autoplayOn') : t('player.autoplayOff')}
        </p>
      </div>
      <Toggle checked={autoplay} onChange={() => setAutoplay(!autoplay)} />
    </div>
  );
}
