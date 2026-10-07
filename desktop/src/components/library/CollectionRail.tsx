import {memo, type ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import {fc} from '../../lib/formatters';
import {ChevronRight} from '../../lib/icons';
import {HorizontalScroll} from '../ui/HorizontalScroll';

interface CollectionRailProps {
    icon: ReactNode;
    title: string;
    count?: number;
    to: string;
    state?: unknown;
    children: ReactNode;
}

/** A preview shelf in the hub: a slice of one collection, with "see all"
 *  leading to its dedicated page. The deep browsing lives there, not here. */
export const CollectionRail = memo(function CollectionRail({
                                                               icon,
                                                               title,
                                                               count,
                                                               to,
                                                               state,
                                                               children,
                                                           }: CollectionRailProps) {
    const {t} = useTranslation();
    return (
        <section>
            <div className="flex items-center gap-2.5 mb-3 px-1">
                <span className="text-white/55">{icon}</span>
                <h2 className="text-[16px] font-bold tracking-tight text-white/90">{title}</h2>
                {count != null && count > 0 && (
                    <span className="text-[12px] text-white/30 tabular-nums">{fc(count)}</span>
                )}
                <Link
                    to={to}
                    state={state}
                    className="ml-auto flex items-center gap-0.5 text-[12px] font-semibold text-white/45 hover:text-white/90 transition-colors"
                >
                    {t('library.seeAll')}
                    <ChevronRight size={14}/>
                </Link>
            </div>
            <HorizontalScroll>{children}</HorizontalScroll>
        </section>
    );
});
