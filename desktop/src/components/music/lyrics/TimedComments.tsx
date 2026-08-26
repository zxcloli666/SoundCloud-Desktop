import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {getCurrentTime, seek} from '../../../lib/audio';
import {ago, art, durLong} from '../../../lib/formatters';
import {type Comment, useTrackComments} from '../../../lib/hooks';
import {Loader2, MessageCircle} from '../../../lib/icons';
import {usePerfMode} from '../../../lib/perf';

const TimedCommentCard = React.memo(
    ({
         comment,
         state,
         onSeek,
     }: {
        comment: Comment;
        state: 'past' | 'active' | 'future';
        onSeek: (seconds: number) => void;
    }) => {
        const avatar = art(comment.user.avatar_url, 'small');
        const commentTime = comment.timestamp != null ? comment.timestamp / 1000 : 0;

        return (
            <button
                type="button"
                onClick={() => onSeek(commentTime)}
                className={`w-full text-left rounded-2xl border px-4 py-3 transition-all duration-300 cursor-pointer ${
                    state === 'active'
                        ? 'bg-gradient-to-br from-white/[0.14] to-white/[0.08] border-white/14 ring-1 ring-accent/25 shadow-[0_16px_36px_rgba(0,0,0,0.26)]'
                        : state === 'past'
                            ? 'bg-white/[0.025] border-white/[0.035] hover:bg-white/[0.04]'
                            : 'bg-white/[0.045] border-white/[0.05] hover:bg-white/[0.06]'
                }`}
            >
                <div className="flex items-start gap-3">
                    <img
                        src={avatar ?? ''}
                        alt=""
                        className="w-9 h-9 rounded-full shrink-0 ring-1 ring-white/[0.08]"
                    />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
              <span className="text-[12px] font-medium text-white/78 truncate">
                {comment.user.username}
              </span>
                            <span
                                className={`text-[10px] tabular-nums shrink-0 ${
                                    state === 'active' ? 'text-accent' : 'text-white/30'
                                }`}
                            >
                {durLong(comment.timestamp ?? 0)}
              </span>
                            <span className="text-[10px] text-white/18 ml-auto shrink-0">
                {ago(comment.created_at)}
              </span>
                        </div>
                        <p className="selectable mt-1 text-[13px] leading-relaxed text-white/58 break-words">
                            {comment.body}
                        </p>
                    </div>
                </div>
            </button>
        );
    },
);

export const TimedCommentsRail = React.memo(({trackUrn}: { trackUrn: string }) => {
    const {t} = useTranslation();
    const perf = usePerfMode();
    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef(new Map<number, HTMLDivElement>());
    const [activeIndex, setActiveIndex] = useState(-1);
    const autoPagesRef = useRef({trackUrn, fetched: 0});
    const {comments, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading} =
        useTrackComments(trackUrn);

    const timedComments = useMemo(
        () =>
            [...comments]
                .filter((comment) => comment.timestamp != null && comment.body.trim())
                .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)),
        [comments],
    );

    useEffect(() => {
        if (autoPagesRef.current.trackUrn !== trackUrn) {
            autoPagesRef.current = {trackUrn, fetched: 0};
        }
        // A comments rail used to walk every page immediately. Keep a useful
        // 60-comment timeline, but never let a popular track monopolise the API.
        if (!hasNextPage || isFetchingNextPage || autoPagesRef.current.fetched >= 2) return;
        autoPagesRef.current.fetched += 1;
        void fetchNextPage();
    }, [fetchNextPage, hasNextPage, isFetchingNextPage, trackUrn]);

    useEffect(() => {
        const getIndexForTime = (timeMs: number) => {
            if (timedComments.length === 0) return -1;
            let lo = 0;
            let hi = timedComments.length - 1;
            let best = -1;
            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                const timestamp = timedComments[mid].timestamp ?? 0;
                if (timestamp <= timeMs) {
                    best = mid;
                    lo = mid + 1;
                } else {
                    hi = mid - 1;
                }
            }
            return best;
        };

        const syncActiveIndex = () => {
            const nextIndex = getIndexForTime(Math.max(0, getCurrentTime()) * 1000);
            setActiveIndex((prev) => (prev === nextIndex ? prev : nextIndex));
        };

        let id = 0;
        const applyVisibility = () => {
            const hidden = document.visibilityState === 'hidden';
            if (hidden) {
                if (id) {
                    window.clearInterval(id);
                    id = 0;
                }
            } else if (!id) {
                syncActiveIndex();
                id = window.setInterval(syncActiveIndex, 250);
            }
        };

        applyVisibility();
        document.addEventListener('visibilitychange', applyVisibility);
        return () => {
            if (id) window.clearInterval(id);
            document.removeEventListener('visibilitychange', applyVisibility);
        };
    }, [timedComments]);

    const focusIndex = activeIndex >= 0 ? activeIndex : timedComments.length > 0 ? 0 : -1;

    useEffect(() => {
        if (focusIndex < 0) return;
        const container = containerRef.current;
        const item = itemRefs.current.get(timedComments[focusIndex]?.id ?? -1);
        if (!container || !item) return;
        const top = item.offsetTop - container.clientHeight / 2 + item.clientHeight / 2;
        container.scrollTo({top: Math.max(0, top), behavior: 'smooth'});
    }, [focusIndex, timedComments]);

    if (isLoading && timedComments.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <Loader2 size={24} className="animate-spin text-white/15"/>
                <p className="text-[13px] text-white/25">{t('track.comments')}</p>
            </div>
        );
    }

    if (timedComments.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-12 text-center">
                <MessageCircle size={40} className="text-white/[0.06]"/>
                <p className="text-[15px] text-white/30 font-medium">{t('track.noComments')}</p>
            </div>
        );
    }

    return (
        <div className="flex-1 min-h-0 px-8 pb-8">
            <div
                ref={containerRef}
                className="h-full overflow-y-auto scrollbar-hide px-4 py-[32vh] space-y-3 relative"
                style={{
                    maskImage: 'linear-gradient(transparent 0%, black 12%, black 88%, transparent 100%)',
                }}
            >
                {timedComments.map((comment, index) => {
                    const state = index < activeIndex ? 'past' : index === activeIndex ? 'active' : 'future';
                    const distance = Math.abs(index - focusIndex);
                    const scale = Math.max(0.9, 1 - distance * 0.035);
                    const opacity =
                        state === 'active' ? 1 : Math.max(0.28, distance === 0 ? 0.94 : 1 - distance * 0.15);
                    const cardBlur = perf.blur(distance >= 4 ? 1.5 : distance >= 2 ? 0.6 : 0);

                    return (
                        <div
                            key={comment.id}
                            ref={(node) => {
                                if (node) itemRefs.current.set(comment.id, node);
                                else itemRefs.current.delete(comment.id);
                            }}
                            className="relative"
                            style={{
                                transform: `scale(${scale}) translateZ(0)`,
                                opacity,
                                filter: cardBlur > 0 ? `blur(${cardBlur}px)` : 'none',
                            }}
                        >
                            <TimedCommentCard
                                comment={comment}
                                state={state}
                                onSeek={(seconds) => seek(seconds)}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
