import { arrayMove } from '@dnd-kit/sortable';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Clapperboard, Film, InfinityLoop, Sparkles } from '../../../lib/icons';
import { canPlayH264 } from '../../../lib/video-element';
import { videoOrder } from '../../../lib/video-pick';
import type { VideoKind } from '../../../stores/player';
import { useSettingsStore } from '../../../stores/settings';
import { Card, Toggle } from '../primitives';
import { LayoutList } from './LayoutList';

const ICONS: Record<VideoKind, ReactNode> = {
  clip: <Clapperboard size={16} />,
  loop: <InfinityLoop size={16} />,
  generated: <Sparkles size={16} />,
};

export function VideoCard() {
  const { t } = useTranslation();
  const enabled = useSettingsStore((s) => s.videoEnabled);
  const setEnabled = useSettingsStore((s) => s.setVideoEnabled);
  const savedOrder = useSettingsStore((s) => s.videoOrder);
  const off = useSettingsStore((s) => s.videoOff);
  const setOrder = useSettingsStore((s) => s.setVideoOrder);
  const setKindOn = useSettingsStore((s) => s.setVideoKindOn);
  const supported = canPlayH264();
  const live = enabled && supported;
  const order = videoOrder(savedOrder);

  const labels: Record<VideoKind, ReactNode> = {
    clip: <span data-ui="settings-row">{t('settings.videoClip')}</span>,
    loop: <span data-ui="settings-row">{t('settings.videoLoop')}</span>,
    generated: <span data-ui="settings-row">{t('settings.videoGenerated')}</span>,
  };
  const names: Record<VideoKind, string> = {
    clip: t('settings.videoClip'),
    loop: t('settings.videoLoop'),
    generated: t('settings.videoGenerated'),
  };

  const items = order.map((kind) => {
    const on = !off.includes(kind);
    return {
      id: kind,
      icon: ICONS[kind],
      label: labels[kind],
      hint: kind === 'generated' ? t('settings.videoGeneratedHint') : undefined,
      dimmed: !on,
      trailing: <Toggle checked={on} label={names[kind]} onChange={() => setKindOn(kind, !on)} />,
    };
  });

  const move = (from: string, to: string) =>
    setOrder(arrayMove(order, order.indexOf(from as VideoKind), order.indexOf(to as VideoKind)));

  return (
    <Card
      title={t('settings.video')}
      icon={<Film size={17} />}
      action={
        supported ? (
          <Toggle
            checked={enabled}
            label={t('settings.video')}
            onChange={() => setEnabled(!enabled)}
          />
        ) : (
          <span className="rounded-full bg-ink/[0.06] px-2.5 py-1 text-[11px] font-semibold text-ink-40 ring-1 ring-ink/[0.08]">
            {t('settings.videoNoCodec')}
          </span>
        )
      }
    >
      <div
        data-ui="settings-row"
        inert={!live}
        aria-disabled={!live}
        className={`space-y-2.5 transition-opacity duration-200 ${live ? '' : 'opacity-40 grayscale'}`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-35">
          {t('settings.videoOrder')}
        </p>
        <LayoutList items={items} onMove={move} />
      </div>
    </Card>
  );
}
