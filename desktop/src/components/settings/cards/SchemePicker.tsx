import {useTranslation} from 'react-i18next';
import type {Scheme, SchemeChoice} from '../../../lib/scheme';
import {activeLook} from '../../../lib/themes/records';
import {useSettingsStore} from '../../../stores/settings';
import {useThemesStore} from '../../../stores/themes';

const CHOICES: SchemeChoice[] = ['dark', 'white', 'system'];

function MiniWindow({scheme, className = ''}: { scheme: Scheme; className?: string }) {
    return (
        <div data-scheme={scheme} className={`absolute inset-y-0 flex bg-paper ${className}`}>
            <div className="w-1/4 h-full bg-ink/[0.05] border-r border-ink/[0.06] p-1.5 space-y-1">
                <div className="h-1 w-3/4 rounded-full bg-accent"/>
                <div className="h-1 w-full rounded-full bg-ink/20"/>
                <div className="h-1 w-2/3 rounded-full bg-ink/20"/>
            </div>
            <div className="flex-1 p-2 space-y-1.5">
                <div className="h-1.5 w-1/2 rounded-full bg-ink/60"/>
                <div className="h-5 rounded-md bg-ink/[0.06] border border-ink/[0.08]"/>
                <div className="h-1 w-3/4 rounded-full bg-ink/20"/>
            </div>
        </div>
    );
}

export function SchemePicker() {
    const {t} = useTranslation();
    const scheme = useSettingsStore((s) => s.scheme);
    const setScheme = useSettingsStore((s) => s.setScheme);
    const locked = useThemesStore(activeLook) !== null;

    return (
        <div className="space-y-3">
            <label className="text-[13px] text-ink-50 font-medium">{t('settings.scheme')}</label>
            <div className={`grid grid-cols-3 gap-3 ${locked ? 'opacity-50 pointer-events-none' : ''}`}>
                {CHOICES.map((id) => {
                    const isActive = scheme === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            data-ui="segment"
                            data-active={isActive}
                            onClick={() => setScheme(id)}
                            className={`relative rounded-2xl overflow-hidden border transition-all duration-200 cursor-pointer hover:scale-[1.03] active:scale-[0.97] ${
                                isActive
                                    ? 'border-ink/30 ring-1 ring-ink/20'
                                    : 'border-ink/[0.06] hover:border-ink/15'
                            }`}
                        >
                            <div className="relative h-16 overflow-hidden">
                                {id === 'system' ? (
                                    <>
                                        <MiniWindow scheme="dark" className="left-0 w-full [clip-path:polygon(0_0,55%_0,45%_100%,0_100%)]"/>
                                        <MiniWindow scheme="white" className="left-0 w-full [clip-path:polygon(55%_0,100%_0,100%_100%,45%_100%)]"/>
                                    </>
                                ) : (
                                    <MiniWindow scheme={id} className="inset-x-0"/>
                                )}
                            </div>
                            <div className="px-3 py-2 bg-ink/[0.03] text-center">
                                <span className={`text-[12px] font-medium ${isActive ? 'text-ink-90' : 'text-ink-50'}`}>
                                    {t(`settings.scheme_${id}`)}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
