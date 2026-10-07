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
import { Card, Divider, Row, Toggle } from '../primitives';

const rgb = ([r, g, b]: Rgb, alpha = 1) => `rgba(${r}, ${g}, ${b}, ${alpha})`;

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="w-5 h-5 rounded-full border border-white/20 shadow-md"
      style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}` }}
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
      className="relative h-24 rounded-2xl overflow-hidden border border-white/[0.06] transition-[background] duration-700"
      style={{
        background:
          a && b
            ? `radial-gradient(80% 120% at 0% 0%, ${rgb(a, 0.55)}, transparent 70%), radial-gradient(70% 110% at 100% 100%, ${rgb(b, 0.4)}, transparent 70%), rgba(255,255,255,0.02)`
            : 'rgba(255,255,255,0.02)',
      }}
    >
      {artwork && palette ? (
        <div className="absolute inset-0 flex items-center gap-4 px-4">
          <img
            src={artwork}
            alt=""
            className="w-16 h-16 rounded-xl object-cover shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
          />
          <div className="flex items-center gap-2">
            {a && <Swatch color={rgb(a)} />}
            {b && <Swatch color={rgb(b)} />}
            {palette.accent && <Swatch color={palette.accent} />}
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[12px] text-white/35">
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
      <div className="space-y-4">
        <CoverPreview palette={palette} artwork={artwork} />
        <div>
          <Row title={t('settings.coverTint')} desc={t('settings.coverTintDesc')}>
            <Toggle checked={coverTint} onChange={() => setCoverTint(!coverTint)} />
          </Row>
          <Divider />
          <Row title={t('settings.coverAccent')} desc={t('settings.coverAccentDesc')}>
            <Toggle checked={coverAccent} onChange={() => setCoverAccent(!coverAccent)} />
          </Row>
        </div>
      </div>
    </Card>
  );
}
