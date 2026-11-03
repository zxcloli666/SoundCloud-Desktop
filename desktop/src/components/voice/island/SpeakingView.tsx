import { useTranslation } from 'react-i18next';
import { useVoiceStore } from '../../../lib/voice/store';
import { VoiceAvatar } from '../VoiceAvatar';
import { voiceById } from '../voices';
import { CloseX } from './parts';

export function SpeakingView({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const voice = voiceById(useVoiceStore((s) => s.config.speak.voice));
  const name = t(`voice.voices.${voice.id}.name`);
  return (
    <>
      <VoiceAvatar voice={voice} name={name} size={40} speaking />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-ink-90">{name}</span>
        <span aria-hidden className="mt-1 flex h-3 items-end gap-[3px]">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <span
              key={i}
              className="w-[3px] origin-bottom rounded-full bg-accent motion-reduce:animate-none"
              style={{
                height: '100%',
                animation: `vx-bars ${0.7 + (i % 3) * 0.18}s ease-in-out ${i * 0.09}s infinite`,
              }}
            />
          ))}
        </span>
      </span>
      <CloseX onClick={onClose} label={t('voice.hud.hush')} />
    </>
  );
}
