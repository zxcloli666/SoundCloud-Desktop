import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../../stores/settings';

export function CoverFade() {
  const { t } = useTranslation();
  const value = useSettingsStore((s) => s.videoCoverOpacity);
  const setValue = useSettingsStore((s) => s.setVideoCoverOpacity);
  return (
    <div
      data-ui="lyrics-cover-fade"
      data-scheme="dark"
      className="absolute inset-x-6 bottom-3 z-10 flex items-center rounded-full bg-black/45 px-3 py-2 opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover/art:opacity-100 focus-within:opacity-100"
    >
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        aria-label={t('settings.videoCoverOpacity')}
        onChange={(e) => setValue(Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-ink/20 accent-[var(--color-accent)] [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink"
      />
    </div>
  );
}
