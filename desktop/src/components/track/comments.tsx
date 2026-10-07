import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';
import {getCurrentTime, subscribe} from '../../lib/audio';
import {ago, art, durLong} from '../../lib/formatters';
import {type Comment, usePostComment} from '../../lib/hooks';
import {Clock, Loader2, Play, Send} from '../../lib/icons';
import {RichText} from '../ui/RichText';

/** A single voice in the room. The MOMENT it was left at (a glowing, genre-toned,
 *  clickable timestamp) is the hero of the card — click it to jump there. */
export const VoiceCard = React.memo(function VoiceCard({
                                                           comment,
                                                           accent,
                                                           accentSoft,
                                                           accentGlow,
                                                           maxSeconds,
                                                           onSeek,
                                                       }: {
    comment: Comment;
    accent: string;
    accentSoft: string;
    accentGlow: string;
    maxSeconds: number;
    onSeek: (seconds: number) => void;
}) {
    const navigate = useNavigate();
    const {t} = useTranslation();
    const ts = comment.timestamp;
    const avatar = art(comment.user.avatar_url, 'small');
    const goUser = () => navigate(`/user/${encodeURIComponent(comment.user.urn)}`);

    return (
        <div
            className="group relative rounded-2xl p-4 pl-5 transition-all duration-300 ease-[var(--ease-apple)] hover:-translate-y-0.5"
            style={{
                background: 'rgba(255,255,255,0.035)',
                border: '0.5px solid rgba(255,255,255,0.06)',
            }}
        >
            {ts != null && (
                <span
                    className="absolute left-0 top-4 bottom-4 w-[2.5px] rounded-full"
                    style={{background: accent, boxShadow: `0 0 12px ${accentGlow}`}}
                />
            )}
            <div className="flex gap-3">
                <button type="button" onClick={goUser} className="shrink-0 cursor-pointer">
                    <img
                        src={avatar ?? ''}
                        alt=""
                        loading="lazy"
                        className="w-9 h-9 rounded-full object-cover ring-1 ring-white/[0.08] hover:ring-white/[0.22] transition-all duration-200"
                    />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
            <span
                onClick={goUser}
                className="text-[12.5px] font-semibold text-white/85 hover:text-white cursor-pointer transition-colors truncate"
            >
              {comment.user.username}
            </span>
                        <span className="text-[10px] text-white/25 shrink-0">{ago(comment.created_at)}</span>
                        {ts != null && (
                            <button
                                type="button"
                                onClick={() => onSeek(ts / 1000)}
                                title={t('track.seekTo', {time: durLong(ts)})}
                                className="ml-auto inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold tabular-nums cursor-pointer transition-transform duration-200 hover:scale-105 shrink-0"
                                style={{background: accentSoft, color: accent}}
                            >
                                <Play size={8} fill="currentColor"/>
                                {durLong(ts)}
                            </button>
                        )}
                    </div>
                    <p className="selectable text-[13.5px] text-white/70 mt-1.5 leading-relaxed break-words">
                        <RichText
                            text={comment.body}
                            maxSeconds={maxSeconds}
                            onSeek={onSeek}
                            accent={accent}
                            accentSoft={accentSoft}
                        />
                    </p>
                </div>
            </div>
        </div>
    );
});

/** Composer that pins your voice to the current moment — when the track is
 *  playing it shows, live, the timestamp your comment will land on. */
export const CommentForm = React.memo(function CommentForm({
                                                               trackUrn,
                                                               isCurrent,
                                                               accent,
                                                               accentSoft,
                                                           }: {
    trackUrn: string;
    isCurrent: boolean;
    accent: string;
    accentSoft: string;
}) {
    const {t} = useTranslation();
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
        mutation.mutate({body: text, timestamp: time > 0 ? Math.floor(time * 1000) : undefined});
        setBody('');
    };

    return (
        <div
            className="rounded-2xl px-4 py-3"
            style={{
                background: 'rgba(255,255,255,0.045)',
                border: '0.5px solid rgba(255,255,255,0.08)',
            }}
        >
            {isCurrent && (
                <div
                    className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold uppercase tracking-[0.16em]"
                    style={{color: accent}}
                >
                    <Clock size={10}/>
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
            className="selectable flex-1 bg-transparent text-[13px] text-white/80 placeholder:text-white/20 outline-none resize-none leading-relaxed"
        />
                <button
                    type="button"
                    onClick={submit}
                    disabled={!body.trim() || mutation.isPending}
                    className="w-9 h-9 rounded-xl flex items-center justify-center self-end transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-default"
                    style={{color: accent, background: body.trim() ? accentSoft : 'transparent'}}
                >
                    {mutation.isPending ? <Loader2 size={15} className="animate-spin"/> : <Send size={15}/>}
                </button>
            </div>
        </div>
    );
});
