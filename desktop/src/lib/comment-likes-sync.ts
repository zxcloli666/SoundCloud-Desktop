import { useEffect, useRef } from 'react';
import { ApiError, apiRequest } from './api-client';
import {
  type CommentLikeReading,
  getCommentLike,
  seedCommentLikes,
  shiftCommentLike,
} from './comment-likes';
import type { Comment } from './hooks';
import { guardLink, mobileWrite, noteReadRefusal, useMobileReads } from './mobile-actions';
import { queryClient } from './query-client';

const BATCH = 40;
const READ_STALE_MS = 60_000;

interface LikesReply {
  comments: CommentLikeReading[];
}

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let at = 0; at < items.length; at += BATCH) out.push(items.slice(at, at + BATCH));
  return out;
}

async function readBatch(trackUrn: string, urns: string[]): Promise<CommentLikeReading[]> {
  const list = urns.map(encodeURIComponent).join(',');
  try {
    const reply = await apiRequest<LikesReply>(
      `/tracks/${encodeURIComponent(trackUrn)}/comments/likes?comments=${list}`,
    );
    return reply.comments;
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    noteReadRefusal(error);
    return [];
  }
}

export function useCommentLikesRead(trackUrn: string, comments: Comment[]) {
  const reading = useMobileReads();
  const asked = useRef(new Set<string>());

  useEffect(() => {
    if (!reading) return;
    const fresh = comments
      .map((comment) => comment.urn)
      .filter((urn) => urn && !asked.current.has(urn));
    for (const batch of chunks(fresh)) {
      for (const urn of batch) asked.current.add(urn);
      queryClient
        .fetchQuery({
          queryKey: ['track', trackUrn, 'comment-likes', batch.join(',')],
          queryFn: () => readBatch(trackUrn, batch),
          staleTime: READ_STALE_MS,
        })
        .then(seedCommentLikes)
        .catch(() => {});
    }
  }, [reading, trackUrn, comments]);
}

export async function setCommentLiked(trackUrn: string, commentUrn: string, liked: boolean) {
  if (!(await guardLink())) return;
  shiftCommentLike(commentUrn, liked);
  const path = `/comments/${encodeURIComponent(commentUrn)}/like?trackUrn=${encodeURIComponent(trackUrn)}`;
  const done = await mobileWrite(liked ? 'PUT' : 'DELETE', path);
  if (!done && getCommentLike(commentUrn)?.liked === liked) shiftCommentLike(commentUrn, !liked);
}
