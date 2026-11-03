import { type KeyboardEvent, memo, type ReactNode, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EFFECT_PRESETS, selectPreset, toggleEffects } from '../../../lib/effects';
import { Lock, Waves, X } from '../../../lib/icons';
import { usePremium } from '../../../lib/premium-cache';
import { type EffectsPresetId, useEffectsStore } from '../../../stores/effects';
import { usePlayerStore } from '../../../stores/player';
import { Toggle } from '../../settings/primitives';
import { StarCta } from '../../star-moments/StarCta';
import { Modal, ModalClose, ModalContent, ModalTrigger } from '../../ui/Modal';
import { TrackSoundToggle } from '../TrackSoundToggle';
import { EffectCanvas } from './EffectCanvas';
import { EffectCard } from './EffectCard';
import { EffectsManual } from './EffectsManual';
import type { Scene } from './scene';

const CARDS: EffectsPresetId[] = ['off', 'slowedReverb', 'spedUp', 'eightD', 'bass', 'custom'];

const QUIET: Scene = { reverb: 0, room: 0.5, eightD: false, eightDHz: 0.15, bassDb: 0, rate: 1 };
const TEASER: Scene = { reverb: 0.5, room: 0.7, eightD: true, eightDHz: 0.15, bassDb: 7, rate: 1 };

function presetScene(id: EffectsPresetId): Scene {
  if (id === 'off' || id === 'custom') return QUIET;
  const preset = EFFECT_PRESETS[id];
  return { ...QUIET, ...preset.fx, rate: preset.rate ?? 1 };
}

function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
  if (!step) return;
  const radios = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')];
  const at = radios.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return;
  event.preventDefault();
  radios[(at + step + radios.length) % radios.length].focus();
}

const LockedBanner = memo(function LockedBanner() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-accent/25 bg-accent/[0.07] px-3.5 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
        <Lock size={15} />
      </div>
      <p className="min-w-0 flex-1 text-[12.5px] font-semibold text-ink-80">
        {t('effects.locked')}
      </p>
      <StarCta size="sm" />
    </div>
  );
});

export const EffectsPanel = memo(function EffectsPanel({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const premium = usePremium();
  const locked = !premium;
  const enabled = useEffectsStore((s) => s.enabled);
  const preset = useEffectsStore((s) => s.preset);
  const reverb = useEffectsStore((s) => s.reverb);
  const room = useEffectsStore((s) => s.room);
  const eightD = useEffectsStore((s) => s.eightD);
  const eightDHz = useEffectsStore((s) => s.eightDHz);
  const bassDb = useEffectsStore((s) => s.bassDb);
  const rate = usePlayerStore((s) => s.playbackRate);

  const live = useMemo<Scene>(
    () =>
      locked
        ? TEASER
        : enabled
          ? { reverb, room, eightD, eightDHz, bassDb, rate }
          : { ...QUIET, rate: 1 },
    [locked, enabled, reverb, room, eightD, eightDHz, bassDb, rate],
  );
  const scenes = useMemo(
    () =>
      Object.fromEntries(
        CARDS.map((id) => [
          id,
          id === 'custom' ? { reverb, room, eightD, eightDHz, bassDb, rate: 1 } : presetScene(id),
        ]),
      ) as Record<EffectsPresetId, Scene>,
    [reverb, room, eightD, eightDHz, bassDb],
  );
  const current: EffectsPresetId = enabled ? preset : 'off';
  const onSelect = useCallback((id: EffectsPresetId) => selectPreset(id), []);

  return (
    <Modal>
      <ModalTrigger asChild>{children}</ModalTrigger>
      <ModalContent size="lg" showClose={false} zClass="z-[90]">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink/[0.06]">
              <Waves size={18} className="text-ink-60" />
            </div>
            <h2 className="text-[17px] font-bold tracking-tight text-ink-90">
              {t('effects.title')}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <Toggle
              checked={enabled && !locked}
              onChange={toggleEffects}
              disabled={locked}
              label={t('effects.toggle')}
            />
            <ModalClose className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-ink/[0.06] bg-ink/[0.04] text-ink-25 transition-all hover:text-ink-50">
              <X size={15} />
            </ModalClose>
          </div>
        </div>

        <div className="space-y-3 px-6 pb-6">
          {locked && <LockedBanner />}

          <div className="overflow-hidden rounded-2xl border border-ink/[0.07] bg-ink/[0.025]">
            <EffectCanvas scene={live} className="block h-[96px] w-full" />
          </div>

          <div
            role="radiogroup"
            aria-label={t('effects.title')}
            onKeyDown={moveFocus}
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            {CARDS.map((id) => (
              <EffectCard
                key={id}
                id={id}
                scene={scenes[id]}
                active={!locked && current === id}
                locked={locked}
                focusable={current === id || (current === 'off' && id === 'off')}
                onSelect={onSelect}
              />
            ))}
          </div>

          <EffectsManual locked={locked} />
          <TrackSoundToggle />
        </div>
      </ModalContent>
    </Modal>
  );
});
