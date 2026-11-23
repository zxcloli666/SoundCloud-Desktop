import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { switchAudioDevice } from '../../../lib/audio';
import { trackedInvoke } from '../../../lib/diagnostics';
import { Volume2 } from '../../../lib/icons';
import { Card } from '../primitives';

interface AudioSink {
  name: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
}

function DeviceOption({
  label,
  active,
  disabled,
  onSelect,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onSelect}
      className={`flex h-10 w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 text-left text-[13px] transition-colors duration-150 disabled:cursor-default ${
        active
          ? 'bg-[var(--set-well-hi)] text-ink'
          : 'text-ink-70 hover:bg-[var(--set-well)] hover:text-ink'
      }`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
          active ? 'border-accent' : 'border-ink/25'
        }`}
      >
        {active && <span className="h-2 w-2 rounded-full bg-accent" />}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

export function AudioDeviceCard() {
  const { t } = useTranslation();
  const [sinks, setSinks] = useState<AudioSink[]>([]);
  const [switching, setSwitching] = useState(false);

  const refreshSinks = useCallback(() => {
    trackedInvoke<AudioSink[]>('audio_list_devices').then(setSinks).catch(console.error);
  }, []);

  useEffect(() => {
    refreshSinks();
    const onFocus = () => refreshSinks();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshSinks]);

  const activeName = sinks.find((s) => s.is_active)?.name ?? null;

  const handleSwitch = async (sinkName: string | null) => {
    if (switching || activeName === sinkName) return;
    setSwitching(true);
    try {
      await switchAudioDevice(sinkName, true);
      toast.success(t('settings.audioDeviceSwitched'));
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSwitching(false);
      refreshSinks();
    }
  };

  if (sinks.length === 0) return null;

  return (
    <Card title={t('settings.audioDevice')} icon={<Volume2 size={17} />}>
      <div
        role="radiogroup"
        aria-label={t('settings.audioDevice')}
        className="-mx-1.5 flex flex-col gap-0.5"
      >
        <DeviceOption
          label={t('settings.audioDeviceDefault')}
          active={activeName === null}
          disabled={switching}
          onSelect={() => handleSwitch(null)}
        />
        {sinks.map((sink) => (
          <DeviceOption
            key={sink.name}
            label={sink.description}
            active={sink.is_active}
            disabled={switching}
            onSelect={() => handleSwitch(sink.name)}
          />
        ))}
      </div>
    </Card>
  );
}
