import { useTranslation } from 'react-i18next';
import { VolumeX } from '../../../lib/icons';
import { useChatLive } from '../../../lib/voice/chat/live';
import { useVoiceRuntime } from '../../../lib/voice/runtime';
import { useVoiceStore } from '../../../lib/voice/store';
import { failureLine } from '../chatFailure';
import { CircleAlert } from '../icons';
import { VoiceAvatar } from '../VoiceAvatar';
import { type VoiceInfo, voiceById } from '../voices';
import { ChatMarks } from './ChatMarks';
import { CloseX } from './parts';
import { ReplyText } from './ReplyText';

type Phase = 'live' | 'done' | 'failed';

function Face({ voice, phase, speaking }: { voice: VoiceInfo; phase: Phase; speaking: boolean }) {
  const silent = useChatLive((s) => s.parts.length === 0);
  const thinking = phase === 'live' && silent && !speaking;
  return (
    <span
      className="relative mt-0.5 shrink-0 transition-opacity duration-500"
      style={{ opacity: phase === 'failed' ? 0.55 : 1 }}
    >
      <VoiceAvatar voice={voice} size={40} speaking={speaking} />
      {thinking && (
        <span
          aria-hidden
          className="absolute -inset-[3px] rounded-full motion-reduce:animate-none"
          style={{
            background: `conic-gradient(from 0deg, transparent, ${voice.glow} 120deg, transparent 220deg)`,
            WebkitMask:
              'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px))',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px))',
            animation: 'vx-spin 1.1s linear infinite',
          }}
        />
      )}
    </span>
  );
}

function Failure({ code }: { code: string }) {
  const { t } = useTranslation();
  const alone = useChatLive((s) => s.parts.length === 0 && s.marks.length === 0);
  if (alone) {
    return (
      <span className="mt-0.5 block text-[13px] font-medium leading-[1.4] text-ink-55">
        {failureLine(code, t)}
      </span>
    );
  }
  return (
    <span className="mt-1 flex items-center gap-1 text-[11px] text-ink-45">
      <CircleAlert size={11} />
      {failureLine(code, t)}
    </span>
  );
}

export function ChatView({
  heard,
  phase,
  undo,
  code,
  voiceLost,
  onUndo,
  onClose,
}: {
  heard: string;
  phase: Phase;
  undo: string | null;
  code: string;
  voiceLost: boolean;
  onUndo: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const voice = voiceById(useVoiceStore((s) => s.config.speak.voice));
  const speaking = useVoiceRuntime((s) => s.engine === 'speaking' && !s.previewing);
  const busy = phase === 'live' || speaking;
  return (
    <span className="flex min-w-0 flex-1 items-start gap-3 py-0.5">
      <Face voice={voice} phase={phase} speaking={speaking} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-1.5 leading-tight">
          <span className="shrink-0 text-[12px] font-bold text-ink-85">
            {t(`voice.voices.${voice.id}.name`)}
          </span>
          <span className="min-w-0 truncate text-[11.5px] text-ink-35">
            {t('voice.quote', { text: heard })}
          </span>
        </span>
        <ReplyText live={phase === 'live'} />
        <ChatMarks undo={phase === 'done' ? undo : null} onUndo={onUndo} />
        {phase === 'failed' && <Failure code={code} />}
        {voiceLost && (
          <span className="mt-1 flex items-center gap-1 text-[11px] text-ink-45">
            <VolumeX size={11} />
            {t('voice.error.tts_failed')}
          </span>
        )}
      </span>
      <CloseX onClick={onClose} label={busy ? t('voice.hud.hush') : t('common.close')} />
    </span>
  );
}
