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

function optionClass(active: boolean) {
  return `flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200 cursor-pointer border ${
    active
      ? 'bg-white/[0.1] text-white/90 border-white/[0.15]'
      : 'bg-white/[0.02] text-white/40 border-white/[0.05] hover:bg-white/[0.06] hover:text-white/60'
  } disabled:opacity-50`;
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
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => handleSwitch(null)}
          disabled={switching}
          className={optionClass(activeName === null)}
        >
          {t('settings.audioDeviceDefault')}
        </button>
        {sinks.map((sink) => (
          <button
            key={sink.name}
            type="button"
            onClick={() => handleSwitch(sink.name)}
            disabled={switching}
            className={optionClass(sink.is_active)}
          >
            {sink.description}
          </button>
        ))}
      </div>
    </Card>
  );
}
