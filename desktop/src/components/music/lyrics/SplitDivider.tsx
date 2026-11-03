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
        const pointerXRef = useRef(0);
        const grabOffsetRef = useRef(0);
        const frameRef = useRef(0);
        const dragRatioRef = useRef<number | null>(null);
        const splitPercent = splitRatio * 100;

        useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

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

        const applyPointer = () => {
            frameRef.current = 0;
            const layout = layoutRef.current;
            const divider = dividerRef.current;
            if (!layout || !divider) return;
            const rect = layout.getBoundingClientRect();
            if (rect.width <= 0) return;
            const ratio = clampLyricsSplit((pointerXRef.current - grabOffsetRef.current - rect.left) / rect.width);
            const percent = ratio * 100;
            layout.style.gridTemplateColumns = `${percent}% ${100 - percent}%`;
            divider.style.left = `${percent}%`;
            dragRatioRef.current = ratio;
        };

        const stop = () => {
            if (!draggingRef.current) return;
            draggingRef.current = false;
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
                applyPointer();
            }
            setActive(false);
            const ratio = dragRatioRef.current;
            dragRatioRef.current = null;
            if (ratio !== null) onChange(ratio);
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
                className="group/splitter absolute top-0 bottom-0 z-20 w-8 -translate-x-1/2 touch-none cursor-col-resize outline-none"
                style={{left: `${splitPercent}%`}}
                onPointerDown={(event) => {
                    event.preventDefault();
                    const rect = event.currentTarget.getBoundingClientRect();
                    grabOffsetRef.current = event.clientX - (rect.left + rect.width / 2);
                    draggingRef.current = true;
                    setActive(true);
                    event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onDoubleClick={(event) => {
                    event.preventDefault();
                    onChange(LYRICS_SPLIT_DEFAULT);
                }}
                onPointerMove={(event) => {
                    if (!draggingRef.current) return;
                    pointerXRef.current = event.clientX;
                    if (!frameRef.current) frameRef.current = requestAnimationFrame(applyPointer);
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
                    className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
                        active
                            ? 'opacity-100'
                            : 'opacity-0 group-hover/splitter:opacity-100 group-focus-visible/splitter:opacity-100'
                    }`}
                >
                    <div
                        className={`absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 transition-colors duration-150 ${
                            active ? 'bg-ink/20' : 'bg-ink/[0.04] group-hover/splitter:bg-ink/10'
                        }`}
                    />
                    <div
                        className={`absolute left-1/2 top-1/2 flex h-14 w-3 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border transition-all duration-150 ${
                            active
                                ? 'border-ink/18 bg-ink/[0.12] shadow-[0_0_20px_rgba(255,255,255,0.08)]'
                                : 'border-ink/[0.08] bg-ink/[0.04] group-hover/splitter:border-ink/14 group-hover/splitter:bg-ink/[0.08]'
                        }`}
                    >
                        <div className="flex flex-col gap-1.5">
                            <span className="block h-1 w-[2px] rounded-full bg-ink/35"/>
                            <span className="block h-1 w-[2px] rounded-full bg-ink/35"/>
                            <span className="block h-1 w-[2px] rounded-full bg-ink/35"/>
                        </div>
                    </div>
                </div>
            </div>
        );
    },
);
