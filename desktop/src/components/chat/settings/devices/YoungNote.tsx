import { useTranslation } from 'react-i18next';
import { AGE_RULE_MS } from '../../../../lib/chat/device-alerts';
import type { Device, Millis } from '../../../../lib/chat/types';
import { Lock } from '../../../../lib/icons';
import { HistoryRing } from '../../devices/HistoryRing';
import { spanText } from '../../devices/time';
import { grownIn } from './hints';

export function YoungNote({ me, now }: { me: Device; now: Millis }) {
  const { t } = useTranslation();
  const wait = grownIn(me, now);
  return (
    <div className="mb-3 flex items-center gap-3 rounded-[10px] bg-[var(--set-well)] px-3 py-2.5">
      <HistoryRing size={30} stroke={2} tone="wait" progress={(now - me.createdAt) / AGE_RULE_MS}>
        <Lock size={11} className="text-ink-55" />
      </HistoryRing>
      <p className="text-[12px] leading-snug text-ink-55">
        {t('chat.devices.list.young', { span: spanText(t, wait) })}
      </p>
    </div>
  );
}
