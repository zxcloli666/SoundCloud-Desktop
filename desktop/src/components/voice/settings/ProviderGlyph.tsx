import { useTranslation } from 'react-i18next';
import type { SpeakerProvider } from '../../../lib/voice/remote-types';

const COLORS: Record<SpeakerProvider, [string, string]> = {
  alice: ['#b28bff', '#5b2cf0'],
  salut: ['#7ee0a1', '#0f8a4c'],
};

export function ProviderGlyph({ provider, size }: { provider: SpeakerProvider; size: number }) {
  const { t } = useTranslation();
  const [from, to] = COLORS[provider];
  return (
    <span
      data-scheme="dark"
      className="flex shrink-0 items-center justify-center rounded-2xl font-black text-ink"
      style={{
        width: size,
        height: size,
        fontFamily: 'var(--font-display)',
        fontSize: size * 0.42,
        background: `radial-gradient(110% 110% at 28% 18%, ${from}, ${to})`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
      }}
    >
      {t(`voice.speakers.${provider}`).slice(0, 1)}
    </span>
  );
}
