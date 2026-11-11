import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import { chordLabels, parseAccelerator } from '../../../lib/hotkeys/accelerator';
import { Check, Download, Loader2, RefreshCw } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { isMac, isWindows } from '../../../lib/platform';
import { toggleListening } from '../../../lib/voice/listen';
import { downloadMissing } from '../../../lib/voice/models';
import { modelsReady, summarize, useVoiceRuntime } from '../../../lib/voice/runtime';
import { useVoiceStore } from '../../../lib/voice/store';
import { refreshEngine } from '../../../lib/voice/sync';
import type { Model, VoiceLanguage } from '../../../lib/voice/types';
import { Segmented, Toggle } from '../../settings/primitives';
import { KeyCaps } from '../../ui/KeyCap';
import { percent, useFormatBytes } from '../format';
import { Mic, StopSquare } from '../icons';
import { Orb, type OrbMode } from '../Orb';
import { useVoiceGender } from '../useVoiceGender';
import { Pill, SmallButton } from './Block';
import { SpeechBar } from './SpeechBar';

const LANGS: VoiceLanguage[] = ['ru', 'en'];

function useOrbMode(enabled: boolean, ready: boolean): OrbMode {
  const engine = useVoiceRuntime((s) => s.engine);
  const availability = useVoiceRuntime((s) => s.availability);
  if (availability === 'missing') return 'error';
  if (!enabled || !ready) return 'off';
  if (engine === 'listening' || engine === 'thinking' || engine === 'speaking') return engine;
  if (engine === 'error') return 'error';
  return 'idle';
}

function modelsState(models: Model[]): string {
  const s = summarize(models);
  if (s.downloading) return 'downloading';
  return s.broken ? 'broken' : 'models';
}

function heroState(
  missing: boolean,
  enabled: boolean,
  ready: boolean,
  phase: string,
  engine: string,
): string {
  if (missing) return 'missing';
  if (!enabled) return 'off';
  if (!ready) return phase;
  return engine === 'idle' || engine === 'error' ? 'ready' : engine;
}

function HotkeyHint({ hotkey, hold }: { hotkey: string | null; hold: boolean }) {
  const { t } = useTranslation();
  if (!hotkey) return null;
  const labels = chordLabels(parseAccelerator(hotkey), isMac(), isWindows());
  return (
    <span className="hidden items-center gap-2 text-[11.5px] text-ink-40 sm:inline-flex">
      {hold ? t('voice.hero.orHold') : t('voice.hero.orPress')}
      <KeyCaps labels={labels} size="sm" />
    </span>
  );
}

function ModelsLine({ quiet }: { quiet: boolean }) {
  const { t } = useTranslation();
  const bytes = useFormatBytes();
  const s = useVoiceRuntime(useShallow((st) => summarize(st.models)));
  if (s.required === 0) return null;
  if (s.downloading) {
    const pct = percent(s.done, s.total);
    return (
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Loader2
          size={14}
          className="shrink-0 animate-spin text-accent motion-reduce:animate-none"
        />
        <span className="relative h-1.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-ink/[0.08]">
          <span
            className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-accent transition-transform duration-500 ease-out"
            style={{ transform: `scaleX(${pct / 100})` }}
          />
        </span>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-55">
          {pct}% · {bytes(s.done)} / {bytes(s.total)}
        </span>
      </div>
    );
  }
  if (s.ready === s.required) {
    return (
      <Pill tone="ok">
        <Check size={11} />
        {t('voice.hero.modelsReady')}
      </Pill>
    );
  }
  if (quiet) return null;
  return (
    <SmallButton primary onClick={downloadMissing}>
      {s.broken ? <RefreshCw size={12} /> : <Download size={13} />}
      {t(s.broken ? 'voice.hero.repair' : 'voice.hero.download', { size: bytes(s.missingBytes) })}
    </SmallButton>
  );
}

function TurnOnButton() {
  const { t } = useTranslation();
  const bytes = useFormatBytes();
  const patch = useVoiceStore((s) => s.patch);
  const s = useVoiceRuntime(useShallow((st) => summarize(st.models)));
  const missing = s.required > 0 && !s.downloading && s.ready < s.required;
  const turnOn = () => {
    patch({ enabled: true });
    if (missing) downloadMissing();
  };
  return (
    <SmallButton primary onClick={turnOn}>
      {missing && <Download size={13} />}
      {missing
        ? t('voice.hero.turnOnSize', { size: bytes(s.missingBytes) })
        : t('voice.hero.turnOn')}
    </SmallButton>
  );
}

export function HeroCard() {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const config = useVoiceStore((s) => s.config);
  const patch = useVoiceStore((s) => s.patch);
  const engine = useVoiceRuntime((s) => s.engine);
  const availability = useVoiceRuntime((s) => s.availability);
  const ready = useVoiceRuntime((s) => s.models.length === 0 || modelsReady(s.models));
  const mode = useOrbMode(config.enabled, ready);
  const blur = perf.blur(40);
  const listening = engine === 'listening';
  const missing = availability === 'missing';
  const canTalk = config.enabled && ready && !missing;
  const phase = useVoiceRuntime((s) => modelsState(s.models));
  const state = heroState(missing, config.enabled, ready, phase, engine);
  const gender = useVoiceGender();

  return (
    <section
      data-ui="voice-hero"
      className="relative overflow-hidden rounded-[2rem] p-6 md:p-7"
      style={{
        border: '0.5px solid rgb(var(--ink) / 0.1)',
        background:
          blur > 0
            ? 'linear-gradient(160deg, rgb(var(--ink) / 0.07), rgb(var(--ink) / 0.015) 55%, rgb(var(--ink) / 0.04))'
            : 'rgb(var(--surface) / 0.88)',
        backdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.4)` : undefined,
        WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.4)` : undefined,
        boxShadow:
          '0 24px 70px rgb(var(--shade) / calc(0.42 * var(--shade-alpha))), inset 0 1px 0 rgba(255,255,255,0.07)',
      }}
    >
      {perf.bloom && (
        <span
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-28 size-[420px] rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--color-accent-glow) 0%, transparent 65%)',
            opacity: canTalk ? 1 : 0.45,
            contain: 'strict',
            transform: 'translateZ(0)',
            transition: 'opacity 700ms var(--ease-apple)',
          }}
        />
      )}
      <span
        aria-hidden
        className="absolute inset-x-8 top-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgb(var(--ink) / 0.25), transparent)',
        }}
      />
      <div
        className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center"
        style={{ isolation: 'isolate' }}
      >
        <Orb
          size={148}
          mode={mode}
          label={listening ? t('voice.hud.stop') : t('voice.mic.talk')}
          onClick={canTalk ? () => toggleListening('hud') : undefined}
        />
        <div className="w-full min-w-0 flex-1 space-y-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-ink-35">
                {t(`voice.hero.state.${state}`, { context: gender })}
              </p>
              <h3 className="truncate text-[28px] font-black leading-none tracking-tight text-ink">
                {t('voice.assistant')}
              </h3>
            </div>
            <div data-ui="settings-row" className="w-[104px] shrink-0">
              <span className="sr-only">{t('voice.hero.language')}</span>
              <Segmented
                value={config.language}
                options={LANGS.map((id) => ({ id, label: id.toUpperCase() }))}
                onChange={(language) => patch({ language })}
              />
            </div>
            <span data-ui="settings-row" className="flex shrink-0">
              <span className="sr-only">{t('voice.hero.toggle')}</span>
              <Toggle
                checked={config.enabled}
                onChange={() => patch({ enabled: !config.enabled })}
                label={t('voice.hero.toggle')}
              />
            </span>
          </div>
          <SpeechBar example={t('voice.hero.example')} />
          <div className="flex flex-wrap items-center gap-3">
            {missing ? (
              <>
                <Pill tone="bad">{t('voice.hero.engineMissing')}</Pill>
                <SmallButton onClick={refreshEngine}>
                  <RefreshCw size={12} />
                  {t('voice.fix.retry')}
                </SmallButton>
              </>
            ) : !config.enabled ? (
              <TurnOnButton />
            ) : ready ? (
              <>
                <SmallButton primary onClick={() => toggleListening('hud')}>
                  {listening ? <StopSquare size={11} fill="currentColor" /> : <Mic size={13} />}
                  {listening ? t('voice.hud.stop') : t('voice.mic.talk')}
                </SmallButton>
                <HotkeyHint hotkey={config.activation.hotkey} hold={config.activation.hold} />
              </>
            ) : null}
            <span className="ml-auto flex min-w-0 items-center">
              <ModelsLine quiet={!config.enabled} />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
