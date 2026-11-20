import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCommentLike } from '../../lib/comment-likes';
import { setCommentLiked } from '../../lib/comment-likes-sync';
import { fc } from '../../lib/formatters';
import { Heart, Trash2 } from '../../lib/icons';
import { useMobileButtons } from '../../lib/mobile-actions';
import { useAuthStore } from '../../stores/auth';
import { deleteComment } from '../../stores/comment-delete';

export const CommentLikeButton = React.memo(function CommentLikeButton({
  trackUrn,
  commentUrn,
  accent,
}: {
  trackUrn: string;
  commentUrn: string;
  accent: string;
}) {
  const { t } = useTranslation();
  const visible = useMobileButtons();
  const like = useCommentLike(commentUrn);
  if (!visible) return null;
  const liked = like?.liked ?? false;
  const count = like?.count ?? 0;
  const label = t(liked ? 'mobileActions.commentUnlike' : 'mobileActions.commentLike');

  return (
    <button
      type="button"
      data-ui="comment-like"
      aria-pressed={liked}
      aria-label={label}
      title={label}
      onClick={() => void setCommentLiked(trackUrn, commentUrn, !liked)}
      className={`inline-flex items-center gap-1 h-6 px-1.5 rounded-full text-[11px] font-semibold tabular-nums cursor-pointer transition-colors duration-200 ${
        liked ? '' : 'text-ink-30 hover:text-ink-70'
      }`}
      style={liked ? { color: accent } : undefined}
    >
      <Heart size={13} fill={liked ? 'currentColor' : 'none'} />
      {count > 0 && <span>{fc(count)}</span>}
    </button>
  );
});

export const CommentDeleteButton = React.memo(function CommentDeleteButton({
  trackUrn,
  commentUrn,
  authorUrn,
  trackOwned,
}: {
  trackUrn: string;
  commentUrn: string;
  authorUrn: string;
  trackOwned: boolean;
}) {
  const { t } = useTranslation();
  const visible = useMobileButtons();
  const myUrn = useAuthStore((s) => s.user?.urn);
  if (!visible || !(trackOwned || (!!myUrn && authorUrn === myUrn))) return null;
  const label = t('mobileActions.commentDelete');

  return (
    <button
      type="button"
      data-ui="comment-delete"
      aria-label={label}
      title={label}
      onClick={() => void deleteComment(trackUrn, commentUrn)}
      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-ink-30 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all duration-200 cursor-pointer"
    >
      <Trash2 size={13} />
    </button>
  );
});
