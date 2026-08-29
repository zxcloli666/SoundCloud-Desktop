import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
    clampLyricsSplit,
    LYRICS_SPLIT_DEFAULT,
    LYRICS_SPLIT_KEYBOARD_STEP,
    LYRICS_SPLIT_MAX,
    LYRICS_SPLIT_MIN,
} from '../../../stores/lyrics';

export const SplitDivider = React.memo(
    ({
         splitRatio,
         onChange,
         layoutRef,
     }: {
        splitRatio: number;
        onChange: (ratio: number) => void;
        layoutRef: React.RefObject<HTMLDivElement | null>;
    }) => {
        const {t} = useTranslation();
        const [active, setActive] = useState(false);
        const dividerRef = useRef<HTMLDivElement>(null);
        const draggingRef = useRef(false);
        const latestRatioRef = useRef(splitRatio);
        const dragRectRef = useRef<{left: number; width: number} | null>(null);
        const splitPercent = splitRatio * 100;
        latestRatioRef.current = splitRatio;

        useEffect(() => {
            if (!active) return;
            const prevCursor = document.body.style.cursor;
            const prevSelect = document.body.style.userSelect;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            return () => {
                document.body.style.cursor = prevCursor;
                document.body.style.userSelect = prevSelect;
            };
        }, [active]);

        const updateFromX = (clientX: number) => {
            const layout = layoutRef.current;
            if (!layout) return;
            const rect = dragRectRef.current ?? layout.getBoundingClientRect();
            if (rect.width <= 0) return;
            const ratio = clampLyricsSplit((clientX - rect.left) / rect.width);
            latestRatioRef.current = ratio;
            const percent = ratio * 100;
            // The grid must relayout while dragging, but React and Zustand do not:
            // persist the final ratio once on release instead of on every pointermove.
            layout.style.gridTemplateColumns = `${percent}% ${100 - percent}%`;
            if (dividerRef.current) {
                dividerRef.current.style.left = `${percent}%`;
                dividerRef.current.setAttribute('aria-valuenow', String(Math.round(percent)));
            }
        };

        const stop = () => {
            if (!draggingRef.current) return;
            draggingRef.current = false;
            dragRectRef.current = null;
            setActive(false);
            onChange(latestRatioRef.current);
        };

        return (
            <div
                ref={dividerRef}
                role="separator"
                aria-label={t('track.resizeLayout')}
                aria-orientation="vertical"
                aria-valuemin={Math.round(LYRICS_SPLIT_MIN * 100)}
                aria-valuemax={Math.round(LYRICS_SPLIT_MAX * 100)}
                aria-valuenow={Math.round(splitPercent)}
                tabIndex={0}
                className="group/splitter absolute top-0 bottom-0 z-20 w-6 -translate-x-1/2 touch-none cursor-col-resize outline-none"
                style={{left: `${splitPercent}%`}}
                onPointerDown={(event) => {
                    event.preventDefault();
                    draggingRef.current = true;
                    const rect = layoutRef.current?.getBoundingClientRect();
                    dragRectRef.current = rect ? {left: rect.left, width: rect.width} : null;
                    setActive(true);
                    event.currentTarget.setPointerCapture(event.pointerId);
                    updateFromX(event.clientX);
                }}
                onDoubleClick={(event) => {
                    event.preventDefault();
                    draggingRef.current = false;
                    dragRectRef.current = null;
                    setActive(false);
                    latestRatioRef.current = LYRICS_SPLIT_DEFAULT;
                    onChange(LYRICS_SPLIT_DEFAULT);
                }}
                onPointerMove={(event) => {
                    if (!draggingRef.current) return;
                    updateFromX(event.clientX);
                }}
                onPointerUp={stop}
                onPointerCancel={stop}
                onLostPointerCapture={stop}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowLeft') {
                        event.preventDefault();
                        onChange(clampLyricsSplit(splitRatio - LYRICS_SPLIT_KEYBOARD_STEP));
                    } else if (event.key === 'ArrowRight') {
                        event.preventDefault();
                        onChange(clampLyricsSplit(splitRatio + LYRICS_SPLIT_KEYBOARD_STEP));
                    }
                }}
            >
                <div
                    className={`absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 transition-colors duration-150 ${
                        active ? 'bg-white/20' : 'bg-white/[0.04] group-hover/splitter:bg-white/10'
                    }`}
                />
                <div
                    className={`absolute left-1/2 top-1/2 flex h-14 w-3 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border transition-all duration-150 ${
                        active
                            ? 'border-white/18 bg-white/[0.12] shadow-[0_0_20px_rgba(255,255,255,0.08)]'
                            : 'border-white/[0.08] bg-white/[0.04] group-hover/splitter:border-white/14 group-hover/splitter:bg-white/[0.08]'
                    }`}
                >
                    <div className="flex flex-col gap-1.5">
                        <span className="block h-1 w-[2px] rounded-full bg-white/35"/>
                        <span className="block h-1 w-[2px] rounded-full bg-white/35"/>
                        <span className="block h-1 w-[2px] rounded-full bg-white/35"/>
                    </div>
                </div>
            </div>
        );
    },
);
