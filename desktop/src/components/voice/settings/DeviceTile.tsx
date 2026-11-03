import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, TriangleAlert } from '../../../lib/icons';
import type { Device, Transport } from '../../../lib/voice/types';
import { Toggle } from '../../settings/primitives';
import { Bluetooth, Cable, Laptop, Mic, Usb } from '../icons';
import { Pill } from './Block';
import { LevelBar } from './LevelBar';

function transportIcon(transport: Transport): ReactNode {
  if (transport === 'builtin') return <Laptop size={16} />;
  if (transport === 'usb') return <Usb size={16} />;
  if (transport === 'bluetooth') return <Bluetooth size={16} />;
  if (transport === 'hdmi') return <Monitor size={16} />;
  if (transport === 'virtual') return <Cable size={16} />;
  return <Mic size={16} />;
}

export const DeviceTile = memo(function DeviceTile({
  device,
  on,
  toggle,
}: {
  device: Device;
  on: boolean;
  toggle: (() => void) | null;
}) {
  const { t } = useTranslation();
  const bt = device.transport === 'bluetooth';
  return (
    <div
      data-ui="voice-device"
      data-on={on ? 'true' : 'false'}
      className={`relative flex flex-col gap-2.5 rounded-2xl border p-3.5 transition-all duration-500 ease-[var(--ease-apple)] ${
        on ? 'border-accent/35 bg-accent/[0.05]' : 'border-ink/[0.07] bg-ink/[0.02]'
      }`}
      style={on ? { boxShadow: '0 10px 30px -18px var(--color-accent-glow)' } : undefined}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-500 ${
            on ? 'bg-accent/15 text-accent' : 'bg-ink/[0.06] text-ink-50'
          }`}
        >
          {transportIcon(device.transport)}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[13px] font-semibold ${on ? 'text-ink-90' : 'text-ink-60'}`}>
            {device.name}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {device.default && <Pill tone="muted">{t('voice.mics.default')}</Pill>}
            {bt && <Pill tone={on ? 'warn' : 'muted'}>{t('voice.mics.bluetooth')}</Pill>}
          </div>
        </div>
        {toggle && <Toggle checked={on} onChange={toggle} label={device.name} />}
      </div>
      <LevelBar input={device.id} on={on} />
      {bt && on && (
        <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-amber-300">
          <TriangleAlert size={12} className="shrink-0" />
          {t('voice.mics.btWarning')}
        </p>
      )}
    </div>
  );
});
