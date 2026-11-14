import { useEffect, useState } from 'react';
import { changeAppLanguage } from '../../../i18n';
import { usePerfMode } from '../../../lib/perf';
import { toggleListening } from '../../../lib/voice/listen';
import { useVoiceRuntime } from '../../../lib/voice/runtime';
import { Settings } from '../../../pages/Settings';
import { useSettingsStore } from '../../../stores/settings';
import { VOICE_KEYFRAMES } from '../keyframes';
import { NavBridge } from '../nav';
import { VoiceIsland } from '../VoiceIsland';
import { HudGallery } from './HudGallery';
import { applyScene, SCENES, type Scene } from './scenes';

type Scheme = 'dark' | 'white';
type Perf = 'beauty' | 'light';

function param(name: string, fallback: string): string {
  return new URLSearchParams(window.location.search).get(name) ?? fallback;
}

function writeParam(name: string, value: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(name, value);
  window.history.replaceState(null, '', url);
}

function Chips<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <span className="flex gap-1 rounded-xl bg-ink/[0.05] p-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`cursor-pointer rounded-lg px-2.5 py-1 font-mono text-[11px] ${o === value ? 'bg-accent text-accent-contrast' : 'text-ink-60 hover:bg-ink/[0.08]'}`}
        >
          {o}
        </button>
      ))}
    </span>
  );
}

export function VoiceLab() {
  const [scene, setScene] = useState<Scene>(() => param('scene', 'ready') as Scene);
  const [scheme, setScheme] = useState<Scheme>(() => param('scheme', 'dark') as Scheme);
  const [perf, setPerf] = useState<Perf>(() => param('perf', 'beauty') as Perf);
  const [lang, setLang] = useState(() => param('lang', 'ru'));
  const chrome = param('chrome', '1') !== '0';
  const profile = usePerfMode();
  const hud = useVoiceRuntime((s) => s.hud.kind);

  useEffect(() => {
    writeParam('scene', scene);
    applyScene(scene);
  }, [scene]);

  useEffect(() => {
    writeParam('scheme', scheme);
    writeParam('perf', perf);
    useSettingsStore.setState({ scheme, perfMode: perf });
  }, [scheme, perf]);

  useEffect(() => {
    writeParam('lang', lang);
    void changeAppLanguage(lang);
  }, [lang]);

  return (
    <div
      id="voice-lab-scroll"
      className="h-screen overflow-y-auto bg-paper text-ink"
      data-lab-perf={profile.mode}
    >
      <style>{VOICE_KEYFRAMES}</style>
      <NavBridge />
      {chrome && (
        <div className="sticky top-0 z-[80] flex flex-wrap items-center gap-3 border-b border-ink/[0.08] bg-surface/90 px-4 py-2.5">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
            voice lab
          </span>
          <Chips value={scene} options={SCENES} onChange={setScene} />
          <Chips value={scheme} options={['dark', 'white'] as const} onChange={setScheme} />
          <Chips value={perf} options={['beauty', 'light'] as const} onChange={setPerf} />
          <Chips
            value={lang}
            options={['ru', 'en', 'tr', 'ko', 'pt'] as const}
            onChange={setLang}
          />
          <button
            type="button"
            onClick={() => toggleListening('button')}
            className="ml-auto cursor-pointer rounded-lg bg-accent px-3 py-1 font-mono text-[11px] text-accent-contrast"
          >
            talk ({hud})
          </button>
        </div>
      )}
      {scene === 'hud' ? <HudGallery /> : <Settings />}
      {scene !== 'hud' && <VoiceIsland />}
    </div>
  );
}
