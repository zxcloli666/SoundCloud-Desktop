import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { falseWakesToday, useVoiceStore, type WakeMark } from '../../../lib/voice/store';
import { wakeNames } from '../../../lib/voice/wake-names';
import { RangeSlider } from '../../settings/primitives';
import { Pill, SmallButton } from './Block';

const HOUR = 3_600_000;

function Hours({ log, now }: { log: WakeMark[]; now: number }) {
  const bins = Array.from({ length: 24 }, () => ({ ok: 0, bad: 0 }));
  for (const mark of log) {
    const age = Math.floor((now - mark.at) / HOUR);
    if (age < 0 || age > 23) continue;
    const bin = bins[23 - age];
    if (mark.ok) bin.ok++;
    else bin.bad++;
  }
  const peak = Math.max(1, ...bins.map((b) => b.ok + b.bad));
  return (
    <span aria-hidden className="flex h-7 items-end gap-[2px]">
      {bins.map((b, i) => (
        <span
          key={i}
          className="flex w-[5px] flex-col-reverse overflow-hidden rounded-[2px] bg-ink/[0.06]"
          style={{ height: '100%' }}
        >
          <span className="bg-ok/70" style={{ height: `${(b.ok / peak) * 100}%` }} />
          <span className="bg-bad" style={{ height: `${(b.bad / peak) * 100}%` }} />
        </span>
      ))}
    </span>
  );
}

export function WakeBlock() {
  const { t } = useTranslation();
  const wake = useVoiceStore((s) => s.config.activation.wake);
  const echo = useVoiceStore((s) => s.config.echo);
  const log = useVoiceStore((s) => s.wakeLog);
  const language = useVoiceStore((s) => s.config.language);
  const voice = useVoiceStore((s) => s.config.speak.voice);
  const patchWake = useVoiceStore((s) => s.patchWake);
  const patch = useVoiceStore((s) => s.patch);
  const [now] = useState(() => Date.now());
  const falses = falseWakesToday(log, now);
  const names = wakeNames(language, voice);

  return (
    <div className="space-y-4">
      {echo === 'off' && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] px-3.5 py-2.5">
          <span className="flex-1 text-[12px] font-semibold text-amber-300">
            {t('voice.activation.needsEcho')}
          </span>
          <SmallButton onClick={() => patch({ echo: 'auto' })}>
            {t('voice.activation.echoOn')}
          </SmallButton>
        </div>
      )}
      <ul aria-label={t('voice.activation.names')} className="flex flex-wrap items-center gap-1.5">
        {names.map((name) => (
          <li key={name}>
            <Pill tone="accent">{name}</Pill>
          </li>
        ))}
      </ul>
      <div>
        <div className="mb-2 flex items-center justify-between text-[11.5px] font-medium text-ink-45">
          <span>{t('voice.activation.rarer')}</span>
          <span className="font-mono tabular-nums text-ink-70">
            {Math.round(wake.sensitivity * 100)}
          </span>
          <span>{t('voice.activation.oftener')}</span>
        </div>
        <RangeSlider
          value={wake.sensitivity}
          min={0}
          max={1}
          step={0.05}
          onChange={(sensitivity) => patchWake({ sensitivity })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <Hours log={log} now={now} />
          <span className="text-[12px] leading-tight">
            <span className={`block font-semibold ${falses > 2 ? 'text-bad' : 'text-ink-80'}`}>
              {t('voice.activation.falseCount', { count: falses })}
            </span>
            <span className="text-ink-40">{t('voice.activation.lastDay')}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
