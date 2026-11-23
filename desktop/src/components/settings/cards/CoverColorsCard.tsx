import { useTranslation } from 'react-i18next';
import {
  type CoverPalette,
  coverSrc,
  type Rgb,
  tintFromRgb,
  useCoverPalette,
} from '../../../lib/cover-palette';
import { Palette } from '../../../lib/icons';
import { usePlayerStore } from '../../../stores/player';
import { useSettingsStore } from '../../../stores/settings';
import { Card, Row, Toggle } from '../primitives';

const rgb = ([r, g, b]: Rgb, alpha = 1) => `rgba(${r}, ${g}, ${b}, ${alpha})`;

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="h-5 w-5 rounded-full border border-ink/20"
      style={{ backgroundColor: color }}
    />
  );
}

function CoverPreview({
  palette,
  artwork,
}: {
  palette: CoverPalette | null;
  artwork: string | null;
}) {
  const { t } = useTranslation();
  const a = palette ? tintFromRgb(palette.primary) : null;
  const b = palette ? tintFromRgb(palette.secondary) : null;

  return (
    <div
      className="relative h-24 overflow-hidden rounded-[12px] border border-[color:var(--set-line)] transition-[background] duration-700"
      style={{
        background:
          a && b
            ? `radial-gradient(80% 120% at 0% 0%, ${rgb(a, 0.55)}, transparent 70%), radial-gradient(70% 110% at 100% 100%, ${rgb(b, 0.4)}, transparent 70%), rgb(var(--ink) / 0.02)`
            : 'rgb(var(--ink) / 0.02)',
      }}
    >
      {artwork && palette ? (
        <div className="absolute inset-0 flex items-center gap-4 px-4">
          <img
            src={artwork}
            alt=""
            className="h-16 w-16 rounded-[10px] object-cover shadow-[0_6px_18px_rgb(var(--shade)/calc(0.35*var(--shade-alpha)))]"
          />
          <div className="flex items-center gap-2">
            {a && <Swatch color={rgb(a)} />}
            {b && <Swatch color={rgb(b)} />}
            {palette.accent && <Swatch color={palette.accent} />}
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[12px] text-ink-40">
          {t('settings.coverPreviewIdle')}
        </div>
      )}
    </div>
  );
}

export function CoverColorsCard() {
  const { t } = useTranslation();
  const coverTint = useSettingsStore((s) => s.coverTint);
  const coverAccent = useSettingsStore((s) => s.coverAccent);
  const setCoverTint = useSettingsStore((s) => s.setCoverTint);
  const setCoverAccent = useSettingsStore((s) => s.setCoverAccent);
  const artwork = usePlayerStore((s) => coverSrc(s.currentTrack?.artwork_url));
  const palette = useCoverPalette(true);

  return (
    <Card
      title={t('settings.coverTitle')}
      desc={t('settings.coverDesc')}
      icon={<Palette size={17} />}
    >
      <CoverPreview palette={palette} artwork={artwork} />
      <Row title={t('settings.coverTint')} desc={t('settings.coverTintDesc')}>
        <Toggle
          checked={coverTint}
          onChange={() => setCoverTint(!coverTint)}
          label={t('settings.coverTint')}
        />
      </Row>
      <Row title={t('settings.coverAccent')} desc={t('settings.coverAccentDesc')}>
        <Toggle
          checked={coverAccent}
          onChange={() => setCoverAccent(!coverAccent)}
          label={t('settings.coverAccent')}
        />
      </Row>
    </Card>
  );
}
