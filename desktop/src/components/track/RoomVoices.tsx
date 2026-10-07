import React from 'react';
import {useTranslation} from 'react-i18next';
import {fc} from '../../lib/formatters';
import type {Comment} from '../../lib/hooks';
import {Loader2, MessageCircle} from '../../lib/icons';
import {CommentForm, VoiceCard} from './comments';
import type {TrackAura} from './useTrackAura';

/** Listeners' Voices — the room's wall of voice-cards. Every timestamped comment
 *  is a clickable jump-cut into the song; the composer pins to the live moment. */
export const RoomVoices = React.memo(function RoomVoices({
                                                             trackUrn,
                                                             durationMs,
                                                             commentCount,
                                                             comments,
                                                             loading,
                                                             fetchingMore,
                                                             sentinelRef,
                                                             isCurrent,
                                                             aura,
                                                             onSeek,
                                                         }: {
    trackUrn: string;
    durationMs: number;
    commentCount?: number;
    comments: Comment[];
    loading: boolean;
    fetchingMore: boolean;
    sentinelRef: React.Ref<HTMLDivElement>;
    isCurrent: boolean;
    aura: TrackAura;
    onSeek: (seconds: number) => void;
}) {
    const {t} = useTranslation();

    return (
        <section className="space-y-5">
            <div className="flex items-center gap-3">
        <span
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
            style={{background: aura.accentSoft, color: aura.accent}}
        >
          <MessageCircle size={14}/>
        </span>
                <h2 className="text-[16px] font-bold text-white/85">{t('track.listenersVoices')}</h2>
                {commentCount != null && (
                    <span
                        className="text-[11px] font-semibold tabular-nums px-2.5 h-6 inline-flex items-center rounded-full text-white/45"
                        style={{background: 'rgba(255,255,255,0.05)'}}
                    >
            {fc(commentCount)}
          </span>
                )}
            </div>

            <CommentForm
                trackUrn={trackUrn}
                isCurrent={isCurrent}
                accent={aura.accent}
                accentSoft={aura.accentSoft}
            />

            {loading ? (
                <div className="flex justify-center py-10">
                    <Loader2 size={18} className="text-white/15 animate-spin"/>
                </div>
            ) : comments.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-4">
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center"
                        style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '0.5px solid rgba(255,255,255,0.06)',
                        }}
                    >
                        <MessageCircle size={24} className="text-white/15"/>
                    </div>
                    <p className="text-white/30 text-sm">{t('track.noComments')}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {comments.map((c) => (
                        <VoiceCard
                            key={c.id}
                            comment={c}
                            accent={aura.accent}
                            accentSoft={aura.accentSoft}
                            accentGlow={aura.accentGlow}
                            maxSeconds={durationMs / 1000}
                            onSeek={onSeek}
                        />
                    ))}
                    <div ref={sentinelRef} className="h-4 flex items-center justify-center">
                        {fetchingMore && <Loader2 size={14} className="text-white/15 animate-spin"/>}
                    </div>
                </div>
            )}
        </section>
    );
});
