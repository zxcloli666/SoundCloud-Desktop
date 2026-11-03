import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Download, RotateCcw, Trash2 } from '../../../lib/icons';
import { deleteModel, downloadModel } from '../../../lib/voice/models';
import type { Model } from '../../../lib/voice/types';
import { percent, useFormatBytes } from '../format';
import { AudioWaveform, Brain, Ear, Languages, Speaker, WandSparkles } from '../icons';
import { Pill, SmallButton } from './Block';

function kindIcon(kind: string): ReactNode {
  if (kind === 'asr') return <Ear size={16} />;
  if (kind === 'vad') return <AudioWaveform size={16} />;
  if (kind === 'tts') return <Speaker size={16} />;
  if (kind === 'wake') return <WandSparkles size={16} />;
  if (kind === 'llm') return <Brain size={16} />;
  return <Languages size={16} />;
}

const OWN_LICENSE = 'own';

function licenseLabel(license: string, own: string): string {
  return license.toLowerCase() === OWN_LICENSE ? own : license;
}

export const ModelRow = memo(function ModelRow({ model }: { model: Model }) {
  const { t } = useTranslation();
  const bytes = useFormatBytes();
  const total = model.total || model.size;
  const pct = percent(model.done, total);
  const name = t(`voice.models.kind.${model.kind}`, { defaultValue: model.id });
  const lang = model.language && model.language !== 'any' ? model.language.toUpperCase() : null;

  return (
    <div
      data-ui="voice-model"
      data-state={model.state}
      className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0"
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-500 ${
          model.state === 'ready'
            ? 'bg-ok/10 text-ok'
            : model.state === 'corrupted'
              ? 'bg-bad/10 text-bad'
              : model.state === 'downloading'
                ? 'bg-accent/15 text-accent'
                : 'bg-ink/[0.06] text-ink-50'
        }`}
      >
        {kindIcon(model.kind)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-semibold text-ink-85">{name}</span>
          {lang && (
            <span className="rounded-md bg-ink/[0.07] px-1.5 py-[1px] font-mono text-[9.5px] font-bold text-ink-55">
              {lang}
            </span>
          )}
          {model.optional && <Pill tone="muted">{t('voice.models.optional')}</Pill>}
        </div>
        {model.state === 'downloading' || model.state === 'partial' ? (
          <div className="mt-1.5 flex items-center gap-2.5">
            <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-ink/[0.08]">
              <span
                className={`absolute inset-y-0 left-0 w-full origin-left rounded-full transition-transform duration-500 ease-out ${model.state === 'partial' ? 'bg-ink/30' : 'bg-accent'}`}
                style={{ transform: `scaleX(${pct / 100})` }}
              />
            </span>
            <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-ink-50">
              {bytes(model.done)} / {bytes(total)}
            </span>
          </div>
        ) : (
          <p className="mt-0.5 text-[11.5px] text-ink-40">
            {bytes(total)}
            {model.license && ` · ${licenseLabel(model.license, t('voice.models.own'))}`}
          </p>
        )}
      </div>
      {model.state === 'ready' && (
        <>
          <Check
            size={15}
            className="shrink-0 text-ok group-hover:hidden group-focus-within:hidden"
          />
          <button
            type="button"
            onClick={() => deleteModel(model.id)}
            aria-label={t('voice.models.delete', { name })}
            title={t('voice.models.delete', { name })}
            className="hidden size-8 shrink-0 cursor-pointer items-center justify-center rounded-xl text-ink-40 transition-colors hover:bg-bad/10 hover:text-bad focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 group-hover:flex group-focus-within:flex"
          >
            <Trash2 size={14} />
          </button>
        </>
      )}
      {model.state === 'downloading' && (
        <span className="w-10 shrink-0 text-right font-mono text-[12px] font-semibold tabular-nums text-accent">
          {pct}%
        </span>
      )}
      {model.state === 'missing' && (
        <SmallButton
          onClick={() => downloadModel(model.id)}
          label={t('voice.models.get', { name })}
        >
          <Download size={13} />
        </SmallButton>
      )}
      {model.state === 'partial' && (
        <SmallButton onClick={() => downloadModel(model.id)}>
          <Download size={13} />
          {t('voice.models.resume')}
        </SmallButton>
      )}
      {model.state === 'corrupted' && (
        <SmallButton danger onClick={() => downloadModel(model.id)}>
          <RotateCcw size={12} />
          {t('voice.models.repair')}
        </SmallButton>
      )}
    </div>
  );
});
