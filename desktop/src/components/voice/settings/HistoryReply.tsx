import { useTranslation } from 'react-i18next';
import type { RowReply } from '../../../lib/voice/store';
import { MarkChip } from '../island/ChatMarks';
import { VoiceAvatar } from '../VoiceAvatar';
import { voiceById } from '../voices';

const LABELLED = 2;

export function HistoryReply({ reply }: { reply: RowReply }) {
  const { t } = useTranslation();
  const voice = voiceById(reply.voice);
  return (
    <div data-ui="voice-history-reply" className="ml-11 mt-2 flex min-w-0 items-start gap-2">
      <span className="mt-0.5 flex shrink-0">
        <VoiceAvatar voice={voice} size={22} />
      </span>
      <div className="min-w-0 max-w-[560px] rounded-2xl rounded-tl-md border border-ink/[0.06] bg-ink/[0.035] px-3 py-2">
        <p className="text-[10.5px] font-bold leading-none text-ink-50">
          {t(`voice.voices.${voice.id}.name`)}
        </p>
        {reply.text && (
          <p className="selectable mt-1 line-clamp-3 whitespace-pre-wrap break-words text-[12.5px] leading-snug text-ink-80">
            {reply.text}
          </p>
        )}
        {reply.marks.length > 0 && (
          <span className="mt-1.5 flex flex-wrap items-center gap-1">
            {reply.marks.map((mark, i) => (
              <MarkChip key={i} mark={mark} labelled={reply.marks.length <= LABELLED} />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
