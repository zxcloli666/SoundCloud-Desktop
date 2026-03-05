import React, { useState } from 'react';
import { usePostComment } from '../../lib/hooks.ts';
import { usePlayerStore } from '../../stores/player.ts';
import { Loader2, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const TrackCommentFormBase = ({ trackUrn }: { trackUrn: string }) => {
  const { t } = useTranslation();
  const [body, setBody] = useState('');
  const mutation = usePostComment(trackUrn);

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    const progress = usePlayerStore.getState().progress;
    const ts = progress > 0 ? Math.floor(progress * 1000) : undefined;
    mutation.mutate({ body: text, timestamp: ts });
    setBody('');
  };

  return (
    <div className="flex gap-3 glass rounded-xl px-4 py-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={t('track.addComment')}
        rows={2}
        className="flex-1 bg-transparent text-[13px] text-white/80 placeholder:text-white/20 outline-none resize-none leading-relaxed"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!body.trim() || mutation.isPending}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-accent hover:bg-accent/10 transition-all duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-default self-end"
      >
        {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
      </button>
    </div>
  );
};
export const TrackCommentForm = React.memo(TrackCommentFormBase);
