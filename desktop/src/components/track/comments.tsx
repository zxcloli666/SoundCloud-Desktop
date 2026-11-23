import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getCurrentTime, subscribe } from '../../lib/audio';
import { ago, art, durLong } from '../../lib/formatters';
import { type Comment, usePostComment } from '../../lib/hooks';
import { Clock, Loader2, Play, Send } from '../../lib/icons';
import { useHiddenComments } from '../../stores/comment-delete';
import { RichText } from '../ui/RichText';
import { CommentDeleteButton, CommentLikeButton } from './CommentActions';

export const VoiceCard = React.memo(function VoiceCard({
  trackUrn,
  trackOwned,
  comment,
  maxSeconds,
  onSeek,
}: {
  trackUrn: string;
  trackOwned: boolean;
  comment: Comment;
  maxSeconds: number;
  onSeek: (seconds: number) => void;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const removed = useHiddenComments((s) => !!s.urns[comment.urn]);
  const ts = comment.timestamp;
  const avatar = art(comment.user.avatar_url, 'small');
  const goUser = () => navigate(`/user/${encodeURIComponent(comment.user.urn)}`);

  return (
    <div
      inert={removed}
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[var(--ease-apple)] ${
        removed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
      }`}
    >
      <div className="min-h-0 overflow-hidden -mx-4 px-4 -mt-1 pt-1">
        <div className="pb-3">
          <div
            data-ui="comment"
            className="panel group relative rounded-2xl bg-ink/[0.03] p-4 transition-colors duration-200 hover:border-ink/[0.11] hover:bg-ink/[0.045]"
          >
            <div className="flex gap-3">
              <button type="button" onClick={goUser} className="shrink-0 cursor-pointer">
                <img
                  src={avatar ?? ''}
                  alt=""
                  loading="lazy"
                  className="w-9 h-9 rounded-full object-cover ring-1 ring-ink/[0.08] hover:ring-ink/[0.22] transition-all duration-200"
                />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    onClick={goUser}
                    className="text-[12.5px] font-semibold text-ink-85 hover:text-ink cursor-pointer transition-colors truncate"
                  >
                    {comment.user.username}
                  </span>
                  <span className="shrink-0 text-[10px] text-ink-35">
                    {ago(comment.created_at)}
                  </span>
                  <div className="ml-auto flex items-center gap-1 shrink-0">
                    <CommentDeleteButton
                      trackUrn={trackUrn}
                      commentUrn={comment.urn}
                      authorUrn={comment.user.urn}
                      trackOwned={trackOwned}
                    />
                    <CommentLikeButton trackUrn={trackUrn} commentUrn={comment.urn} />
                    {ts != null && (
                      <button
                        type="button"
                        onClick={() => onSeek(ts / 1000)}
                        title={t('track.seekTo', { time: durLong(ts) })}
                        className="inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-ink/[0.06] px-2.5 text-[11px] font-semibold tabular-nums text-ink-70 transition-colors duration-200 hover:bg-ink/[0.11] hover:text-ink"
                      >
                        <Play size={8} fill="currentColor" />
                        {durLong(ts)}
                      </button>
                    )}
                  </div>
                </div>
                <p className="selectable text-[13.5px] text-ink-70 mt-1.5 leading-relaxed break-words">
                  <RichText text={comment.body} maxSeconds={maxSeconds} onSeek={onSeek} />
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export const CommentForm = React.memo(function CommentForm({
  trackUrn,
  isCurrent,
}: {
  trackUrn: string;
  isCurrent: boolean;
}) {
  const { t } = useTranslation();
  const [body, setBody] = useState('');
  const mutation = usePostComment(trackUrn);
  const momentRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isCurrent) return;
    const paint = () => {
      const tt = getCurrentTime();
      if (momentRef.current)
        momentRef.current.textContent = durLong(Math.floor(Math.max(0, tt) * 1000));
    };
    paint();
    return subscribe(paint);
  }, [isCurrent]);

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    const time = getCurrentTime();
    mutation.mutate({ body: text, timestamp: time > 0 ? Math.floor(time * 1000) : undefined });
    setBody('');
  };

  return (
    <div className="panel rounded-2xl bg-ink/[0.04] px-4 py-3 transition-colors focus-within:border-ink/[0.16]">
      {isCurrent && (
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          <Clock size={10} />
          {t('track.commentAt')}{' '}
          <span ref={momentRef} className="tabular-nums">
            0:00
          </span>
        </div>
      )}
      <div className="flex gap-3">
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
          className="selectable flex-1 bg-transparent text-[13px] text-ink-80 placeholder:text-ink-35 outline-none resize-none leading-relaxed"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!body.trim() || mutation.isPending}
          aria-label={t('track.addComment')}
          className={`flex h-9 w-9 cursor-pointer items-center justify-center self-end rounded-xl transition-colors duration-200 disabled:cursor-default ${
            body.trim() ? 'bg-accent text-accent-contrast hover:bg-accent-hover' : 'text-ink-35'
          }`}
        >
          {mutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </div>
    </div>
  );
});
