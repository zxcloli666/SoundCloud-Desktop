import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, ShieldAlert } from '../../../lib/icons';
import { voiceIpc } from '../../../lib/voice/ipc';
import { micPrivacyUrl, openMicPrivacy } from '../../../lib/voice/privacy';
import { useVoiceRuntime } from '../../../lib/voice/runtime';
import { useVoiceStore } from '../../../lib/voice/store';
import type { Device, EchoMode, ListenMode } from '../../../lib/voice/types';
import { Card, Segmented } from '../../settings/primitives';
import { AudioWaveform, Mic } from '../icons';
import { Empty, SmallButton } from './Block';
import { DeviceTile } from './DeviceTile';

const MODES: ListenMode[] = ['chosen', 'where_i_speak', 'everywhere'];
const ECHO: EchoMode[] = ['auto', 'on', 'off'];

function refreshDevices() {
  voiceIpc
    .devices()
    .then((devices) => useVoiceRuntime.setState({ devices }))
    .catch(() => {});
}

function chosenIds(devices: Device[], chosen: string[]): string[] {
  if (chosen.length > 0) return chosen;
  const fallback = devices.find((d) => d.default) ?? devices[0];
  return fallback ? [fallback.id] : [];
}

export function MicrophonesCard() {
  const { t } = useTranslation();
  const inputs = useVoiceRuntime((s) => s.devices.inputs);
  const denied = useVoiceRuntime(
    (s) =>
      s.status?.error?.code === 'mic_denied' ||
      (s.hud.kind === 'error' && s.hud.code === 'mic_denied'),
  );
  const listen = useVoiceStore((s) => s.config.listen);
  const echo = useVoiceStore((s) => s.config.echo);
  const patchListen = useVoiceStore((s) => s.patchListen);
  const patch = useVoiceStore((s) => s.patch);

  useEffect(() => {
    refreshDevices();
    void voiceIpc.meter(true).catch(() => {});
    return () => void voiceIpc.meter(false).catch(() => {});
  }, []);

  const chosen = chosenIds(inputs, listen.devices);
  const toggleFor = (id: string) => () => {
    const next = chosen.includes(id) ? chosen.filter((d) => d !== id) : [...chosen, id];
    if (next.length > 0) patchListen({ devices: next });
  };

  return (
    <Card title={t('voice.mics.title')} icon={<Mic size={17} />}>
      {denied ? (
        <Empty
          icon={<ShieldAlert size={22} />}
          text={t('voice.error.mic_denied')}
          action={
            micPrivacyUrl() ? (
              <SmallButton primary onClick={() => openMicPrivacy()}>
                {t('voice.fix.privacy')}
              </SmallButton>
            ) : undefined
          }
        />
      ) : inputs.length === 0 ? (
        <Empty
          icon={<Mic size={22} />}
          text={t('voice.mics.none')}
          action={
            <SmallButton onClick={refreshDevices}>
              <RefreshCw size={12} />
              {t('voice.mics.refresh')}
            </SmallButton>
          }
        />
      ) : (
        <div className="space-y-4">
          <Segmented
            value={listen.mode}
            options={MODES.map((id) => ({ id, label: t(`voice.mics.mode.${id}`) }))}
            onChange={(mode) => patchListen({ mode })}
          />
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {inputs.map((device) => (
              <DeviceTile
                key={device.id}
                device={device}
                on={listen.mode !== 'chosen' || chosen.includes(device.id)}
                toggle={listen.mode === 'chosen' ? toggleFor(device.id) : null}
              />
            ))}
          </div>
        </div>
      )}
      <div
        data-ui="settings-row"
        className="mt-5 flex items-center gap-3 border-t border-ink/[0.05] pt-4"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-ink/[0.06] bg-ink/[0.04] text-ink-55">
          <AudioWaveform size={14} />
        </span>
        <span className="flex-1 text-[13.5px] font-medium text-ink-80">{t('voice.mics.echo')}</span>
        <div className="w-[216px]">
          <Segmented
            value={echo}
            options={ECHO.map((id) => ({ id, label: t(`voice.mics.echoMode.${id}`) }))}
            onChange={(next) => patch({ echo: next })}
          />
        </div>
      </div>
    </Card>
  );
}
