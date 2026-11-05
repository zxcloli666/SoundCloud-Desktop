import { useTranslation } from 'react-i18next';

const SLOTS = Array.from({ length: 32 }, (_, index) => `slot-${index}`);

export function DeviceLimit({ used, max }: { used: number; max: number }) {
  const { t } = useTranslation();
  const full = used >= max;
  return (
    <div
      className="flex items-center gap-2 pt-1"
      title={t('chat.devices.list.limit', { count: used, max })}
    >
      <div className="flex items-center gap-[3px]" aria-hidden>
        {SLOTS.slice(0, Math.min(max, SLOTS.length)).map((slot, index) => (
          <span
            key={slot}
            className={`h-3 w-[5px] rounded-full transition-colors ${
              index < used ? (full ? 'bg-rose-300/80' : 'bg-ink/60') : 'bg-ink/[0.09]'
            }`}
          />
        ))}
      </div>
      <span className="text-[11.5px] font-semibold tabular-nums text-ink-40">
        {used}/{max}
      </span>
    </div>
  );
}
