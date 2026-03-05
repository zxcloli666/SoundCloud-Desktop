import React, { useRef, useState } from 'react'
import { X, Play, Pause, GripVertical, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePlayerStore, type Track } from '../../stores/player.ts'
import { useShallow } from 'zustand/shallow'

function formatDuration(ms: number) {
    const totalSec = Math.floor(ms / 1000)
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
}

/* ── Now Playing (single, non-draggable) ─────────────────────────── */
const NowPlayingItem = React.memo(() => {
    const { currentTrack, isPlaying, pause, resume } = usePlayerStore(
        useShallow((s) => ({
            currentTrack: s.currentTrack,
            isPlaying: s.isPlaying,
            pause: s.pause,
            resume: s.resume,
        }))
    )
    if (!currentTrack) return null
    const artwork = currentTrack.artwork_url?.replace('-large', '-t200x200')

    return (
        <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.08] ring-1 ring-white/[0.08] cursor-pointer"
            onClick={() => (isPlaying ? pause() : resume())}
        >
            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 relative bg-white/[0.04]">
                {artwork ? (
                    <img
                        src={artwork}
                        alt=""
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full" />
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    {isPlaying ? (
                        <div className="flex items-center gap-[2px]">
                            <div className="w-[2px] h-3 bg-accent rounded-full animate-pulse" />
                            <div className="w-[2px] h-2 bg-accent rounded-full animate-pulse [animation-delay:150ms]" />
                            <div className="w-[2px] h-3.5 bg-accent rounded-full animate-pulse [animation-delay:300ms]" />
                        </div>
                    ) : (
                        <Pause size={12} className="text-white" />
                    )}
                </div>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[12px] text-accent font-medium truncate leading-snug">
                    {currentTrack.title}
                </p>
                <p className="text-[10px] text-white/30 truncate mt-0.5">
                    {currentTrack.user.username}
                </p>
            </div>
            <span className="text-[10px] text-white/20 tabular-nums shrink-0">
                {formatDuration(currentTrack.duration)}
            </span>
        </div>
    )
})

/* ── Draggable queue list ────────────────────────────────────────── */
const DraggableQueue = React.memo(({ startIndex }: { startIndex: number }) => {
    const {
        queue,
        queueIndex,
        isPlaying,
        play,
        pause,
        resume,
        removeFromQueue,
        moveInQueue,
    } = usePlayerStore(
        useShallow((s) => ({
            queue: s.queue,
            queueIndex: s.queueIndex,
            isPlaying: s.isPlaying,
            play: s.play,
            pause: s.pause,
            resume: s.resume,
            removeFromQueue: s.removeFromQueue,
            moveInQueue: s.moveInQueue,
        }))
    )

    const items = queue.slice(startIndex)
    const [dragIdx, setDragIdx] = useState<number | null>(null)
    const [overIdx, setOverIdx] = useState<number | null>(null)
    const dragStartY = useRef(0)
    const dragElRef = useRef<HTMLDivElement | null>(null)

    const handleGripDown = (e: React.PointerEvent, localIdx: number) => {
        e.preventDefault()
        e.stopPropagation()
        const absIdx = startIndex + localIdx
        setDragIdx(absIdx)
        setOverIdx(absIdx)
        dragStartY.current = e.clientY
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }

    const handlePointerMove = (e: React.PointerEvent) => {
        if (dragIdx === null || !dragElRef.current) return
        const container = dragElRef.current
        const children = container.querySelectorAll('[data-queue-item]')
        const y = e.clientY

        for (let i = 0; i < children.length; i++) {
            const rect = children[i].getBoundingClientRect()
            const mid = rect.top + rect.height / 2
            if (y < mid) {
                setOverIdx(startIndex + i)
                return
            }
        }
        setOverIdx(startIndex + children.length - 1)
    }

    const handlePointerUp = () => {
        if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
            moveInQueue(dragIdx, overIdx)
        }
        setDragIdx(null)
        setOverIdx(null)
    }

    const handleClick = (track: Track, absIdx: number) => {
        if (absIdx === queueIndex && isPlaying) pause()
        else if (absIdx === queueIndex) resume()
        else play(track, queue)
    }

    return (
        <div
            ref={dragElRef}
            className="flex flex-col gap-0.5"
            onPointerMove={dragIdx !== null ? handlePointerMove : undefined}
            onPointerUp={dragIdx !== null ? handlePointerUp : undefined}
        >
            {items.map((track, localIdx) => {
                const absIdx = startIndex + localIdx
                const isCurrent = absIdx === queueIndex
                const isDragging = absIdx === dragIdx
                const isOver =
                    absIdx === overIdx &&
                    dragIdx !== null &&
                    dragIdx !== overIdx
                const artwork = track.artwork_url?.replace(
                    '-large',
                    '-t200x200'
                )

                return (
                    <div
                        key={`${track.urn}-${absIdx}`}
                        data-queue-item
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl group transition-all duration-150 select-none ${
                            isDragging
                                ? 'opacity-40 scale-[0.97]'
                                : isCurrent
                                  ? 'bg-white/[0.08] ring-1 ring-white/[0.08]'
                                  : 'hover:bg-white/[0.04]'
                        } ${isOver ? 'border-t-2 border-accent' : ''}`}
                    >
                        {/* Grip handle */}
                        <div
                            className="text-white/15 group-hover:text-white/30 hover:!text-white/50 cursor-grab active:cursor-grabbing transition-colors touch-none"
                            onPointerDown={(e) => handleGripDown(e, localIdx)}
                        >
                            <GripVertical size={14} />
                        </div>

                        {/* Artwork */}
                        <div
                            className="w-9 h-9 rounded-lg overflow-hidden shrink-0 relative bg-white/[0.04] cursor-pointer"
                            onClick={() => handleClick(track, absIdx)}
                        >
                            {artwork ? (
                                <img
                                    src={artwork}
                                    alt=""
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full" />
                            )}
                            {isCurrent && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                    {isPlaying ? (
                                        <div className="flex items-center gap-[2px]">
                                            <div className="w-[2px] h-3 bg-accent rounded-full animate-pulse" />
                                            <div className="w-[2px] h-2 bg-accent rounded-full animate-pulse [animation-delay:150ms]" />
                                            <div className="w-[2px] h-3.5 bg-accent rounded-full animate-pulse [animation-delay:300ms]" />
                                        </div>
                                    ) : (
                                        <Pause
                                            size={12}
                                            className="text-white"
                                        />
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Info */}
                        <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => handleClick(track, absIdx)}
                        >
                            <p
                                className={`text-[12px] truncate leading-snug ${isCurrent ? 'text-accent font-medium' : 'text-white/80'}`}
                            >
                                {track.title}
                            </p>
                            <p className="text-[10px] text-white/30 truncate mt-0.5">
                                {track.user.username}
                            </p>
                        </div>

                        {/* Duration */}
                        <span className="text-[10px] text-white/20 tabular-nums shrink-0">
                            {formatDuration(track.duration)}
                        </span>

                        {/* Remove */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                removeFromQueue(absIdx)
                            }}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-white/0 group-hover:text-white/20 hover:!text-white/50 hover:!bg-white/[0.06] transition-all duration-150 cursor-pointer shrink-0"
                        >
                            <X size={12} />
                        </button>
                    </div>
                )
            })}
        </div>
    )
})

/* ── Panel ───────────────────────────────────────────────────────── */
export const QueuePanel = React.memo(
    ({ open, onClose }: { open: boolean; onClose: () => void }) => {
        const { t } = useTranslation()
        const { queue, queueIndex, currentTrack, clearQueue } = usePlayerStore(
            useShallow((s) => ({
                queue: s.queue,
                queueIndex: s.queueIndex,
                currentTrack: s.currentTrack,
                clearQueue: s.clearQueue,
            }))
        )

        const upNextCount = queue.length - queueIndex - 1

        return (
            <>
                {/* Backdrop */}
                <div
                    className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${
                        open ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                    onClick={onClose}
                />

                {/* Panel */}
                <div
                    className={`fixed top-0 right-0 bottom-0 w-[360px] z-50 flex flex-col transition-transform duration-300 ease-[var(--ease-apple)] ${
                        open ? 'translate-x-0' : 'translate-x-full'
                    }`}
                    style={{
                        background: 'rgba(18, 18, 20, 0.88)',
                        backdropFilter: 'blur(60px) saturate(1.8)',
                        borderLeft: '1px solid rgba(255,255,255,0.06)',
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 pt-5 pb-3">
                        <h2 className="text-base font-semibold tracking-tight">
                            {t('playback.queue')}
                        </h2>
                        <div className="flex items-center gap-1">
                            {queue.length > 0 && (
                                <button
                                    type="button"
                                    onClick={clearQueue}
                                    className="h-7 px-2.5 rounded-lg text-[11px] text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all duration-150 cursor-pointer flex items-center gap-1.5"
                                >
                                    <Trash2 size={12} />
                                    {t('playback.clearQueue')}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all duration-150 cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Now Playing (single item, not draggable) */}
                    {currentTrack && (
                        <div className="px-4 pb-2">
                            <p className="text-[10px] text-white/25 uppercase tracking-wider font-medium mb-2 px-1">
                                {t('playback.nowPlaying')}
                            </p>
                            <NowPlayingItem />
                        </div>
                    )}

                    {/* Up Next (draggable) */}
                    <div className="flex-1 overflow-y-auto px-4 pb-4">
                        {upNextCount > 0 && (
                            <>
                                <p className="text-[10px] text-white/25 uppercase tracking-wider font-medium mb-2 mt-3 px-1">
                                    {t('playback.upNext')} · {upNextCount}
                                </p>
                                <DraggableQueue startIndex={queueIndex + 1} />
                            </>
                        )}

                        {queue.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-white/15">
                                <Play size={32} />
                                <p className="text-sm mt-3">Queue is empty</p>
                            </div>
                        )}
                    </div>
                </div>
            </>
        )
    }
)
