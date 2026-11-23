import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCommentLikesRead } from '../../lib/comment-likes-sync';
import { fc } from '../../lib/formatters';
import type { Comment } from '../../lib/hooks';
import { Loader2, MessageCircle } from '../../lib/icons';
import { CommentForm, VoiceCard } from './comments';

export const RoomVoices = React.memo(function RoomVoices({
  trackUrn,
  trackOwned,
  durationMs,
  commentCount,
  comments,
  loading,
  fetchingMore,
  sentinelRef,
  isCurrent,
  onSeek,
}: {
  trackUrn: string;
  trackOwned: boolean;
  durationMs: number;
  commentCount?: number;
  comments: Comment[];
  loading: boolean;
  fetchingMore: boolean;
  sentinelRef: React.Ref<HTMLDivElement>;
  isCurrent: boolean;
  onSeek: (seconds: number) => void;
}) {
  const { t } = useTranslation();
  useCommentLikesRead(trackUrn, comments);

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2.5 px-1">
        <MessageCircle size={16} className="shrink-0 text-ink-55" />
        <h2 className="text-[16px] font-bold tracking-tight text-ink-90">
          {t('track.listenersVoices')}
        </h2>
        {commentCount != null && (
          <span className="text-[12px] tabular-nums text-ink-30">{fc(commentCount)}</span>
        )}
      </div>

      <CommentForm trackUrn={trackUrn} isCurrent={isCurrent} />

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={18} className="text-ink-30 animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink/[0.05] text-ink-35">
            <MessageCircle size={22} />
          </div>
          <p className="text-[13px] text-ink-45">{t('track.noComments')}</p>
        </div>
      ) : (
        <div data-ui="comments">
          {comments.map((c) => (
            <VoiceCard
              key={c.id}
              trackUrn={trackUrn}
              trackOwned={trackOwned}
              comment={c}
              maxSeconds={durationMs / 1000}
              onSeek={onSeek}
            />
          ))}
          <div ref={sentinelRef} className="h-4 flex items-center justify-center">
            {fetchingMore && <Loader2 size={14} className="text-ink-30 animate-spin" />}
          </div>
        </div>
      )}
    </section>
  );
});
