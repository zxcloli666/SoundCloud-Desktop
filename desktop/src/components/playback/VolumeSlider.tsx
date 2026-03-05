import React, { useCallback, useRef, useState } from 'react'
import { usePlayerStore } from '../../stores/player.ts'
import { useShallow } from 'zustand/shallow'

const VolumeSliderBase = ({ className = '' }: { className?: string }) => {
    const { volume, setVolume: onChange } = usePlayerStore(
        useShallow((s) => ({
            volume: s.volume,
            setVolume: s.setVolume,
        }))
    )

    const ref = useRef<HTMLDivElement>(null)
    const [dragging, setDragging] = useState(false)

    const ratio = volume / 200 // 0-1
    const midpoint = 0.5 // 100% mark

    const calcVolume = useCallback((clientX: number) => {
        if (!ref.current) return 0
        const rect = ref.current.getBoundingClientRect()
        const r = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
        return Math.round(r * 200)
    }, [])

    return (
        <div
            ref={ref}
            className={`relative h-5 flex items-center cursor-pointer group ${className}`}
            onPointerDown={(e) => {
                e.preventDefault()
                setDragging(true)
                ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
                onChange(calcVolume(e.clientX))
            }}
            onPointerMove={(e) => {
                if (dragging) onChange(calcVolume(e.clientX))
            }}
            onPointerUp={() => setDragging(false)}
            onPointerLeave={() => setDragging(false)}
            onWheel={(e) => {
                e.preventDefault()
                onChange(
                    Math.max(0, Math.min(200, volume + (e.deltaY < 0 ? 1 : -1)))
                )
            }}
        >
            {/* Track bg */}
            <div className="absolute inset-x-0 h-[3px] rounded-full bg-white/[0.08] group-hover:h-[4px]">
                {/* Normal fill (white) up to min(ratio, midpoint) */}
                <div
                    className="absolute top-0 left-0 h-full rounded-full bg-white/60"
                    style={{ width: `${Math.min(ratio, midpoint) * 100}%` }}
                />
                {/* Extra fill (amber/accent) from midpoint to ratio */}
                {ratio > midpoint && (
                    <div
                        className="absolute top-0 h-full rounded-r-full bg-amber-400/80"
                        style={{
                            left: `${midpoint * 100}%`,
                            width: `${(ratio - midpoint) * 100}%`,
                        }}
                    />
                )}
                {/* 100% tick mark */}
                <div
                    className="absolute top-0 h-full w-px bg-white/20"
                    style={{ left: `${midpoint * 100}%` }}
                />
            </div>
            {/* Thumb */}
            <div
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full  ${
                    ratio > midpoint ? 'bg-amber-400' : 'bg-white'
                } ${
                    dragging
                        ? 'scale-100 opacity-100'
                        : 'scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100'
                }`}
                style={{ left: `${ratio * 100}%` }}
            />
        </div>
    )
}
export const VolumeSlider = React.memo(VolumeSliderBase)
