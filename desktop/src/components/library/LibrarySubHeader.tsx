import {memo, type ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import {type Aura, auraRgb} from '../../lib/aura';
import {fc} from '../../lib/formatters';
import {ChevronLeft, Search as SearchIcon, X} from '../../lib/icons';
import {SyncQueueChip} from './SyncQueueChip';

interface LibrarySubHeaderProps {
    title: string;
    aura: Aura;
    count?: number;
    filter?: string;
    onFilter?: (v: string) => void;
    actions?: ReactNode;
}

/** Shared header for a deep collection page: back to the hub, the title with a
 *  soundprint-tinted accent bar, a live count and an optional filter. */
export const LibrarySubHeader = memo(function LibrarySubHeader({
                                                                   title,
                                                                   aura,
                                                                   count,
                                                                   filter,
                                                                   onFilter,
                                                                   actions,
                                                               }: LibrarySubHeaderProps) {
    const {t} = useTranslation();
    return (
        <div className="mb-6">
            <Link
                to="/library"
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-white/40 hover:text-white/85 transition-colors mb-3"
            >
                <ChevronLeft size={15}/>
                {t('nav.library')}
            </Link>
            <div className="flex items-end justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
          <span
              className="w-1 h-7 rounded-full shrink-0"
              style={{background: auraRgb(aura), boxShadow: `0 0 14px ${auraRgb(aura)}`}}
          />
                    <h1 className="text-[26px] md:text-[30px] font-black tracking-tight text-white/95 truncate">
                        {title}
                    </h1>
                    {count != null && count > 0 && (
                        <span className="text-[14px] text-white/30 tabular-nums font-semibold">
              {fc(count)}
            </span>
                    )}
                    <SyncQueueChip/>
                </div>

                {(onFilter || actions) && (
                    <div className="flex items-center justify-end gap-2 flex-1 min-w-[200px]">
                        {actions}
                        {onFilter && (
                            <div className="relative min-w-[200px] max-w-[320px] flex-1">
                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                    <SearchIcon size={15} className="text-white/30"/>
                                </div>
                                <input
                                    type="text"
                                    value={filter ?? ''}
                                    onChange={(e) => onFilter(e.target.value)}
                                    placeholder={t('library.filter')}
                                    className="w-full bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] text-white/80 placeholder:text-white/25 text-[13px] py-2.5 pl-9 pr-8 rounded-xl outline-none border border-white/[0.05] focus:border-white/[0.12] transition-all duration-200"
                                />
                                {filter && (
                                    <button
                                        type="button"
                                        onClick={() => onFilter('')}
                                        className="absolute inset-y-0 right-2 flex items-center text-white/30 hover:text-white/60 cursor-pointer transition-colors"
                                    >
                                        <X size={14}/>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});
