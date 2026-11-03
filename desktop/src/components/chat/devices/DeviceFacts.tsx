import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Device } from '../../../lib/chat/types';
import { Clock } from '../../../lib/icons';
import { RouteMark } from './RouteMark';

interface DeviceFactsProps {
  device: Device;
  time: string;
  centered?: boolean;
}

export const DeviceFacts = memo(function DeviceFacts({ device, time, centered }: DeviceFactsProps) {
  const { t } = useTranslation();
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-40 ${centered ? 'justify-center' : ''}`}
    >
      <span className="inline-flex items-center gap-1.5">
        <RouteMark tier={device.tier} />
        {t(`chat.devices.tier.${device.tier}`)}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Clock size={11} />
        {time}
      </span>
      <span className="tabular-nums">
        {t('chat.devices.version', { version: device.appVersion })}
      </span>
    </div>
  );
});
