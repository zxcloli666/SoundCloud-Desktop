import { Clock } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Comment } from '../../api/index.ts';
import { ScdnImg } from '../../components/common/ScdnImg.tsx';
import { replaceArtSize, toHourMinSec, toRelativeTime } from '../../lib/utils.ts';

const TrackCommentItemBase = ({ comment }: { comment: Comment }) => {
  const navigate = useNavigate();
  const avatar = replaceArtSize(comment.user.avatar_url, 'small');

  return (
    <div className="flex gap-3 group">
      <ScdnImg
        src={avatar ?? ''}
        alt=""
        className="w-8 h-8 rounded-full shrink-0 ring-1 ring-white/[0.06] mt-0.5 cursor-pointer hover:ring-white/[0.15] transition-all duration-150"
        onClick={() => navigate(`/user/${encodeURIComponent(comment.user.urn)}`)}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-[12px] font-medium text-white/70 hover:text-white/90 cursor-pointer transition-colors duration-150"
            onClick={() => navigate(`/user/${encodeURIComponent(comment.user.urn)}`)}
          >
            {comment.user.username}
          </span>
          {comment.timestamp != null && (
            <span className="text-[10px] text-white/20 tabular-nums flex items-center gap-0.5">
              <Clock size={9} />
              {toHourMinSec(comment.timestamp)}
            </span>
          )}
          <span className="text-[10px] text-white/15 ml-auto shrink-0">
            {toRelativeTime(comment.created_at)}
          </span>
        </div>
        <p className="text-[13px] text-white/55 mt-0.5 leading-relaxed break-words">
          {comment.body}
        </p>
      </div>
    </div>
  );
};
export const TrackCommentItem = React.memo(TrackCommentItemBase);
