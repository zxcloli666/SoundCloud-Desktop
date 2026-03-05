import React, { useCallback, useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '../../stores/player.ts'
import { useShallow } from 'zustand/shallow'
import { throttle } from 'lodash'

const ProgressSliderBase = () => {
    const { duration: max, seek: onChange } = usePlayerStore(
        useShallow((s) => ({
            duration: s.duration,
            seek: s.seek,
        }))
    )

    const [value, setValue] = useState(() => usePlayerStore.getState().progress)

    useEffect(() => {
        const throttledUpdate = throttle((newProgress) => {
            setValue(newProgress)
        }, 200)

        const unsubscribe = usePlayerStore.subscribe((state, prevState) => {
            if (state.progress !== prevState.progress) {
                throttledUpdate(state.progress)
            }
        })

        return () => {
            unsubscribe()
            throttledUpdate.cancel()
        }
    }, [])

    const ref = useRef<HTMLDivElement>(null)
    const [dragging, setDragging] = useState(false)
    const [hoverRatio, setHoverRatio] = useState<number | null>(null)

    const ratio = max > 0 ? Math.min(value / max, 1) : 0
    const activeRatio = dragging && hoverRatio !== null ? hoverRatio : ratio
    const previewRatio = hoverRatio

    const calcRatio = useCallback((clientX: number) => {
        if (!ref.current) return 0
        const rect = ref.current.getBoundingClientRect()
        return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    }, [])

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault()
        setDragging(true)
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        onChange(calcRatio(e.clientX) * max)
    }

    const handlePointerMove = (e: React.PointerEvent) => {
        const r = calcRatio(e.clientX)
        setHoverRatio(r)
        if (dragging) onChange(r * max)
    }

    const handlePointerUp = () => setDragging(false)
    const handlePointerLeave = () => {
        if (!dragging) setHoverRatio(null)
    }

    return (
        <div
            ref={ref}
            className="relative h-5 flex items-center cursor-pointer group"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
        >
            {/* Track bg */}
            <div className="absolute inset-x-0 h-[3px] rounded-full bg-white/[0.08] group-hover:h-[5px] transition-all duration-150">
                {/* Hover preview zone (lighter, behind active) */}
                {previewRatio !== null && !dragging && previewRatio > ratio && (
                    <div
                        className="absolute top-0 h-full rounded-full bg-white/[0.08] transition-[width] duration-75"
                        style={{
                            left: `${ratio * 100}%`,
                            width: `${(previewRatio - ratio) * 100}%`,
                        }}
                    />
                )}
                {/* Active fill */}
                <div
                    className="h-full rounded-full bg-accent transition-[width] duration-75"
                    style={{ width: `${activeRatio * 100}%` }}
                />
            </div>

            {/* Thumb */}
            <div
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full transition-all duration-150 ${
                    dragging
                        ? 'w-4 h-4 scale-100 opacity-100 bg-accent shadow-[0_0_12px_var(--color-accent-glow)]'
                        : 'w-3 h-3 scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 bg-accent shadow-[0_0_10px_var(--color-accent-glow)]'
                }`}
                style={{ left: `${activeRatio * 100}%` }}
            />
        </div>
    )
}

export const ProgressSlider = React.memo(ProgressSliderBase)
