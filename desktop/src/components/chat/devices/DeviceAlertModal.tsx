import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Device } from '../../../lib/chat/types';
import { CircleCheck, ShieldAlert } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { AGE_RULE_MS } from '../../../stores/chat/devices';
import { ModalContent, ModalDescription, ModalTitle } from '../../ui/Modal';
import { AlertLegend, type AlertOutcome } from './AlertLegend';
import { DecisionButton } from './DecisionButton';
import { DeviceFacts } from './DeviceFacts';
import { DeviceGlyph } from './DeviceGlyph';
import { deviceErrorKey } from './errors';
import { DEVICE_KEYFRAMES } from './keyframes';
import { addedText } from './time';
import { useDeviceAction, useDevices } from './useDevices';
import { useNow } from './useNow';

const AUTO_CLOSE_MS = 1_600;

interface DeviceAlertModalProps {
  device: Device;
  open: boolean;
  queued: number;
  onHold: (device: Device | null) => void;
  onClose: () => void;
}

function ringOutcome(outcome: AlertOutcome | null) {
  if (outcome === 'confirmed') return 'open';
  if (outcome === 'revoked') return 'closed';
  return null;
}

export function DeviceAlertModal({ device, open, queued, onHold, onClose }: DeviceAlertModalProps) {
  const { t, i18n } = useTranslation();
  const perf = usePerfMode();
  const now = useNow(60_000);
  const fresh = useDevices().data?.find((item) => item.id === device.id) ?? device;
  const action = useDeviceAction();
  const [outcome, setOutcome] = useState<AlertOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  useEffect(() => {
    if (outcome !== 'confirmed' && outcome !== 'acknowledged') return;
    const timer = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [outcome, onClose]);

  const run = (kind: 'confirm' | 'notMe') => {
    setError(null);
    onHold(device);
    action.mutate(
      { kind, id: device.id },
      {
        onSuccess: () => setOutcome(kind === 'confirm' ? 'confirmed' : 'revoked'),
        onError: (failure) => {
          const key = deviceErrorKey(failure);
          if (key.endsWith('.not_found')) {
            onClose();
            return;
          }
          onHold(null);
          setError(key);
        },
      },
    );
  };

  const actions = outcome === null ? fresh.actions : device.actions;

  const sayYes = () => {
    if (actions.confirm) {
      run('confirm');
      return;
    }
    onHold(device);
    setOutcome('acknowledged');
  };

  const busy = action.isPending ? action.variables?.kind : null;
  const opensIn = device.createdAt + AGE_RULE_MS - now;

  return (
    <ModalContent size="sm" showClose={outcome === null} zClass="z-[95]">
      <style>{DEVICE_KEYFRAMES}</style>
      <div
        data-ui="chat-device-alert"
        className="relative flex flex-col items-center px-7 pb-7 pt-9 text-center"
      >
        {queued > 1 && (
          <span className="absolute left-5 top-5 rounded-full bg-ink/[0.06] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-ink-45">
            {t('chat.devices.alert.queue', { count: queued - 1 })}
          </span>
        )}
        <div className="relative">
          {perf.idleAnim && outcome === null && (
            <span
              aria-hidden
              className="chat-device-motion pointer-events-none absolute inset-0 rounded-full border border-ink/25"
              style={{ animation: 'chat-device-arrive 1.6s var(--ease-apple) 2 both' }}
            />
          )}
          <DeviceGlyph
            device={fresh}
            now={now}
            size={104}
            stroke={3}
            outcome={ringOutcome(outcome)}
          />
        </div>
        <ModalTitle className="mt-5 line-clamp-2 max-w-full text-[19px] font-bold tracking-tight text-ink-92 wrap-anywhere">
          {device.name}
        </ModalTitle>
        <ModalDescription className="mt-1 text-[12.5px] leading-snug text-ink-45">
          {t('chat.devices.alert.title')}
        </ModalDescription>
        <div className="mt-3">
          <DeviceFacts
            device={fresh}
            time={addedText(i18n.language, device.createdAt, now)}
            centered
          />
        </div>
        <AlertLegend outcome={outcome} opensIn={opensIn} />
        {outcome === 'revoked' ? (
          <div className="mt-6 grid w-full">
            <DecisionButton tone="plain" size="lg" onClick={onClose}>
              {t('chat.devices.alert.done')}
            </DecisionButton>
          </div>
        ) : (
          <div
            className={`mt-6 grid w-full gap-2.5 ${actions.notMe ? 'grid-cols-2' : 'grid-cols-1'}`}
          >
            <DecisionButton
              tone="yes"
              size="lg"
              icon={<CircleCheck size={16} />}
              busy={busy === 'confirm'}
              disabled={outcome !== null || busy === 'notMe'}
              onClick={sayYes}
            >
              {t('chat.devices.alert.confirm')}
            </DecisionButton>
            {actions.notMe && (
              <DecisionButton
                tone="no"
                size="lg"
                icon={<ShieldAlert size={16} />}
                busy={busy === 'notMe'}
                disabled={outcome !== null || busy === 'confirm'}
                onClick={() => run('notMe')}
              >
                {t('chat.devices.alert.notMe')}
              </DecisionButton>
            )}
          </div>
        )}
        {error && <p className="mt-3 text-[12px] leading-snug text-rose-300/90">{t(error)}</p>}
      </div>
    </ModalContent>
  );
}
