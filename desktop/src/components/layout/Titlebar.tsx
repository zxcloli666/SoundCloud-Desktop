import { Minus, Square, X, Disc3 } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import React from 'react'

const TitlebarBase = () => {
    const minimize = () => getCurrentWindow().minimize()
    const toggleMaximize = () => getCurrentWindow().toggleMaximize()
    const close = () => getCurrentWindow().close()

    return (
        <div
            className="h-10 flex items-center justify-between px-4 select-none shrink-0 border-b border-white/[0.04]"
            data-tauri-drag-region
        >
            <div className="flex items-center gap-1.5" data-tauri-drag-region>
                <Disc3 size={14} className="text-accent" strokeWidth={2} />
                <span className="text-[11px] font-semibold tracking-tight text-white/30">
                    SoundCloud
                </span>
            </div>

            <div className="flex items-center">
                <button
                    type="button"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition-all duration-150 cursor-pointer"
                    onClick={minimize}
                >
                    <Minus size={13} />
                </button>
                <button
                    type="button"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition-all duration-150 cursor-pointer"
                    onClick={toggleMaximize}
                >
                    <Square size={10} />
                </button>
                <button
                    type="button"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 cursor-pointer"
                    onClick={close}
                >
                    <X size={13} />
                </button>
            </div>
        </div>
    )
}
export const Titlebar = React.memo(TitlebarBase)
