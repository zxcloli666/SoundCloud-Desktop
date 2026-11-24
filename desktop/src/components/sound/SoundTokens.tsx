import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AudioLines, Gauge, ListEnd, Moon, Music, repeatAbIcon16, Waves } from '../../lib/icons';
import { formatPitch, formatRate, type SoundToken } from '../../lib/sound/live';
import { useSleepMinutesLeft } from '../../lib/use-sleep-left';

const SHOWN = 2;

function Token({ icon, children }: { icon: ReactNode; children?: ReactNode }) {
  return (
    <span className="sound-token">
      {icon}
      {children && <span>{children}</span>}
    </span>
  );
}

function SleepToken() {
  const minutes = useSleepMinutesLeft();
  return <Token icon={<Moon />}>{minutes || <ListEnd />}</Token>;
}

function SoundTokenView({ token }: { token: SoundToken }) {
  const { t } = useTranslation();
  if (token.id === 'fx') return <Token icon={<Waves />}>{t(`sound.fx.${token.preset}`)}</Token>;
  if (token.id === 'rate') return <Token icon={<Gauge />}>{formatRate(token.rate)}</Token>;
  if (token.id === 'pitch') return <Token icon={<Music />}>{formatPitch(token.semitones)}</Token>;
  if (token.id === 'sleep') return <SleepToken />;
  return <Token icon={token.id === 'eq' ? <AudioLines /> : repeatAbIcon16} />;
}

export function SoundTokens({ tokens }: { tokens: readonly SoundToken[] }) {
  return (
    <>
      {tokens.slice(0, SHOWN).map((token) => (
        <SoundTokenView key={token.id} token={token} />
      ))}
      {tokens.length > 1 && <span className="sound-count">{tokens.length}</span>}
    </>
  );
}
