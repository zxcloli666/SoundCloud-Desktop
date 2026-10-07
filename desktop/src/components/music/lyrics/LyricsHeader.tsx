import React from 'react';
import {useTranslation} from 'react-i18next';
import {PanelLeftClose, PanelLeftOpen, X} from '../../../lib/icons';
import type {LyricsPanelTab} from '../../../stores/lyrics';

const TabButton = React.memo(
    ({
         active,
         children,
         onClick,
     }: {
        active: boolean;
        children: React.ReactNode;
        onClick: () => void;
    }) => (
        <button
            type="button"
            onClick={onClick}
            className={`px-4 py-1.5 rounded-full text-[12.5px] font-semibold transition-all duration-200 cursor-pointer ${
                active
                    ? 'bg-white/[0.14] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'text-white/40 hover:text-white/80 hover:bg-white/[0.05]'
            }`}
        >
            {children}
        </button>
    ),
);

const glassBtn =
    'w-9 h-9 rounded-full flex items-center justify-center border border-white/[0.08] bg-black/35 backdrop-blur-xl text-white/55 hover:text-white hover:bg-white/[0.14] transition-all duration-200 cursor-pointer outline-none';

interface LyricsHeaderProps {
    tab: LyricsPanelTab;
    rightPanelOpen: boolean;
    onSelectTab: (tab: LyricsPanelTab) => void;
    onTogglePanel: () => void;
    onClose: () => void;
}

/** Floating top chrome. The close button is absolutely pinned top-right so it
 *  never shifts between split / focus modes (the old bug). Tabs float centred in
 *  their own glass pill; the panel toggle + close sit as a fixed right cluster. */
export const LyricsHeader = React.memo(
    ({tab, rightPanelOpen, onSelectTab, onTogglePanel, onClose}: LyricsHeaderProps) => {
        const {t} = useTranslation();
        return (
            <div
                className="absolute top-0 inset-x-0 z-20 h-16 flex items-center justify-end px-5"
                data-tauri-drag-region
            >
                {/* centred tabs */}
                <div
                    className="absolute left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-black/35 backdrop-blur-xl p-1 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
                    <TabButton
                        active={rightPanelOpen && tab === 'lyrics'}
                        onClick={() => onSelectTab('lyrics')}
                    >
                        {t('track.lyrics')}
                    </TabButton>
                    <TabButton
                        active={rightPanelOpen && tab === 'comments'}
                        onClick={() => onSelectTab('comments')}
                    >
                        {t('track.comments')}
                    </TabButton>
                </div>

                {/* fixed right cluster — always top-right */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onTogglePanel}
                        title={rightPanelOpen ? t('track.hidePanel') : t('track.showPanel')}
                        className={glassBtn}
                    >
                        {rightPanelOpen ? <PanelLeftClose size={17}/> : <PanelLeftOpen size={17}/>}
                    </button>
                    <button type="button" onClick={onClose} title={t('common.close')} className={glassBtn}>
                        <X size={18}/>
                    </button>
                </div>
            </div>
        );
    },
);
