import { useTranslation } from 'react-i18next';
import { useTrayAvailable } from '../../../lib/close-action';
import { PictureInPicture2 } from '../../../lib/icons';
import {
  MINI_PLAYER_OPACITY_MIN,
  miniPlayerStockOpacity,
  useSettingsStore,
} from '../../../stores/settings';
import { Card, RangeSlider } from '../primitives';

const CHECKER =
  'repeating-conic-gradient(rgb(var(--ink) / 0.16) 0 25%, rgb(var(--ink) / 0.04) 0 50%) 0 0 / 12px 12px';

export function MiniPlayerCard() {
  const { t } = useTranslation();
  const opacity = useSettingsStore((s) => s.miniPlayerOpacity);
  const perfMode = useSettingsStore((s) => s.perfMode);
  const setOpacity = useSettingsStore((s) => s.setMiniPlayerOpacity);
  const trayAvailable = useTrayAvailable();
  if (!trayAvailable) return null;

  const alpha = opacity ?? miniPlayerStockOpacity(perfMode);
  const percent = Math.round(alpha * 100);

  return (
    <Card
      title={t('trayMenu.mini')}
      desc={t('settings.miniPlayerDesc')}
      icon={<PictureInPicture2 size={17} />}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div
          className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xl border border-ink/[0.06]"
          style={{ background: CHECKER }}
          aria-hidden="true"
        >
          <div
            className="absolute inset-2.5 rounded-[10px] border border-ink/15"
            style={{ background: `rgb(var(--surface) / ${alpha})` }}
          />
          <div className="absolute inset-2.5 flex items-center gap-2 px-2">
            <span className="h-6 w-6 shrink-0 rounded-md bg-accent" />
            <span className="flex flex-col gap-1">
              <span className="h-1.5 w-10 rounded-full bg-ink/85" />
              <span className="h-1.5 w-6 rounded-full bg-ink/40" />
            </span>
          </div>
        </div>
        <div className="min-w-[180px] flex-1">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[13.5px] font-medium text-ink-80">
              {t('settings.miniPlayerOpacity')}
            </span>
            <span className="text-[12px] font-semibold tabular-nums text-ink-60">{percent}%</span>
          </div>
          <RangeSlider
            value={percent}
            min={MINI_PLAYER_OPACITY_MIN * 100}
            max={100}
            step={1}
            onChange={(value) => setOpacity(value / 100)}
          />
        </div>
      </div>
    </Card>
  );
}
