import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Lane } from './Lane';
import { StarMark } from './StarMark';
import type { WaitShape } from './scope';
import './sync-wait.css';

export const PriorityLane = memo(function PriorityLane({ shape }: { shape: WaitShape }) {
  const { t } = useTranslation();
  return (
    <div
      className="sync-wait-rise flex w-full max-w-[440px] items-center gap-3 rounded-full py-1.5 pl-4 pr-4"
      style={{
        background: 'color-mix(in srgb, var(--color-accent) 7%, transparent)',
        boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 22%, transparent)',
      }}
    >
      <StarMark className="text-[10.5px]" />
      <Lane kind="star" shape={shape} size="sm" className="flex-1" />
      <span className="shrink-0 font-mono text-[11px] font-bold text-accent">
        {t('starMoments.sync.starTime')}
      </span>
    </div>
  );
});
