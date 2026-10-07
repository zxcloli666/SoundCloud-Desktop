import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Play } from '../../lib/icons';
import { parseRichText } from '../../lib/rich-text';
import { useRichLinks } from './useRichLinks';

const LINK_LABEL_MAX = 48;

function linkLabel(text: string): string {
  const bare = text.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  return bare.length > LINK_LABEL_MAX ? `${bare.slice(0, LINK_LABEL_MAX - 1)}…` : bare;
}

export const RichText = memo(function RichText({
  text,
  maxSeconds,
  onSeek,
  accent = 'var(--color-accent)',
  accentSoft = 'var(--color-accent-glow)',
}: {
  text: string;
  maxSeconds?: number;
  onSeek?: (seconds: number) => void;
  accent?: string;
  accentSoft?: string;
}) {
  const { t } = useTranslation();
  const { pending, openMention, openLink } = useRichLinks();
  const tokens = useMemo(
    () => parseRichText(text, onSeek ? maxSeconds : null),
    [text, maxSeconds, onSeek],
  );

  return tokens.map((token, i) => {
    if (token.kind === 'text') return token.text;
    if (token.kind === 'time') {
      return (
        <button
          key={i}
          type="button"
          onClick={() => onSeek?.(token.seconds)}
          title={t('track.seekTo', { time: token.text })}
          className="inline-flex items-center gap-[3px] align-baseline px-1.5 rounded-md font-semibold tabular-nums cursor-pointer transition-transform duration-200 hover:scale-105"
          style={{ color: accent, background: accentSoft }}
        >
          <Play size={7} fill="currentColor" />
          {token.text}
        </button>
      );
    }
    if (token.kind === 'mention') {
      return (
        <button
          key={i}
          type="button"
          onClick={() => void openMention(token.permalink)}
          className={`inline font-semibold text-white/85 cursor-pointer underline decoration-white/20 underline-offset-[3px] transition-colors duration-200 hover:text-white hover:decoration-current ${
            pending === token.text ? 'animate-pulse' : ''
          }`}
        >
          {token.text}
        </button>
      );
    }
    return (
      <button
        key={i}
        type="button"
        onClick={() => void openLink(token.href)}
        title={token.href}
        className={`inline break-all cursor-pointer underline decoration-1 underline-offset-[3px] transition-opacity duration-200 hover:opacity-80 ${
          pending === token.href ? 'animate-pulse' : ''
        }`}
        style={{ color: accent }}
      >
        {linkLabel(token.text)}
      </button>
    );
  });
});
