import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Images, Music, Upload, Users } from '../../../../lib/icons';
import { usePerfMode } from '../../../../lib/perf';
import type { BackdropPreset } from '../presets/types';
import { BackdropStage } from './BackdropStage';

export type Focus =
  | { kind: 'preset'; preset: BackdropPreset }
  | { kind: 'none' }
  | { kind: 'photo'; src: string | null }
  | { kind: 'stored'; src: string | null };

function Cover({ cover }: { cover: string | null }) {
  const blur = usePerfMode().blur(30);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-chat-cutout"
    >
      {cover && blur > 0 && (
        <img
          src={cover}
          alt=""
          className="absolute -inset-8 h-[calc(100%+4rem)] w-[calc(100%+4rem)] max-w-none object-cover opacity-50"
          style={{ filter: `blur(${blur}px) saturate(1.5)` }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(160deg, var(--color-accent-glow), transparent 70%)' }}
      />
    </div>
  );
}

function Ground({ focus, cover }: { focus: Focus; cover: string | null }) {
  if (focus.kind === 'preset') {
    const { preset } = focus;
    return (
      <BackdropStage key={preset.id} src={preset.image} light={preset.light} motion={preset.tone} />
    );
  }
  if (focus.kind === 'none') return <Cover cover={cover} />;
  if (focus.src) return <BackdropStage key={focus.src} src={focus.src} motion={null} />;
  const Icon = focus.kind === 'stored' ? Images : Upload;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center bg-ink/[0.04]"
    >
      <Icon size={26} className="text-ink-25" />
    </div>
  );
}

export const PickerPreview = memo(function PickerPreview({
  focus,
  cover,
  title,
  listeners,
}: {
  focus: Focus;
  cover: string | null;
  title: string;
  listeners: number;
}) {
  const { t } = useTranslation();
  const name =
    focus.kind === 'preset'
      ? t(`chat.backdrop.presets.${focus.preset.id}`)
      : focus.kind === 'none'
        ? t('chat.backdrop.none')
        : focus.kind === 'stored'
          ? t('chat.backdrop.stored')
          : t('chat.backdrop.photo');
  return (
    <div className="relative isolate h-40 overflow-hidden rounded-2xl ring-1 ring-ink/[0.08]">
      <Ground focus={focus} cover={cover} />
      <div className="flex h-full flex-col justify-between p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[15px] font-bold tracking-tight text-ink">{title}</span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink/[0.08] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-70">
            <Users size={11} />
            {listeners}
          </span>
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <span className="max-w-[70%] rounded-2xl rounded-bl-md bg-ink/[0.1] px-3 py-1.5 text-[12.5px] text-ink-90">
            {name}
          </span>
          <span className="flex items-center self-end rounded-2xl rounded-br-md bg-accent px-3 py-1.5 text-accent-contrast">
            <Music size={13} />
          </span>
        </div>
      </div>
    </div>
  );
});
