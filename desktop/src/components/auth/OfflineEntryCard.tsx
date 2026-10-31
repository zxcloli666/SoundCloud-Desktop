import {useTranslation} from 'react-i18next';
import {ChevronRight, Download, Globe} from '../../lib/icons';

/** Secondary entry — browse the offline (cached) library without signing in. */
export function OfflineEntryCard({onClick}: { onClick: () => void }) {
    const {t} = useTranslation();
    return (
        <button
            type="button"
            onClick={onClick}
            className="group relative w-full overflow-hidden rounded-[22px] border border-ink/[0.10] bg-[linear-gradient(140deg,rgb(var(--ink)/0.10),rgb(var(--ink)/0.02)_55%,rgb(var(--ink)/0.06))] p-[1px] text-left shadow-[0_18px_50px_rgb(var(--shade)/calc(0.35*var(--shade-alpha))),0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-[40px] transition-all duration-300 ease-[var(--ease-apple)] hover:border-ink/[0.18] hover:shadow-[0_24px_70px_rgb(var(--shade)/calc(0.45*var(--shade-alpha))),0_0_60px_rgba(56,189,248,0.10)] active:scale-[0.985] cursor-pointer"
        >
      <span
          className="pointer-events-none absolute inset-0 rounded-[22px] bg-[radial-gradient(ellipse_at_top_left,rgb(var(--ink)/0.18),transparent_55%)] opacity-80"
          aria-hidden="true"
      />
            <span
                className="pointer-events-none absolute -inset-px rounded-[22px] bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_55%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                aria-hidden="true"
            />

            <span
                className="relative flex items-center gap-3 rounded-[21px] bg-shade-35 px-4 py-3.5 backdrop-blur-[40px]">
        <span
            className="relative flex size-11 shrink-0 items-center justify-center rounded-[16px] border border-ink/[0.16] bg-[linear-gradient(160deg,rgb(var(--ink)/0.16),rgb(var(--ink)/0.04))] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_14px_rgb(var(--shade)/calc(0.25*var(--shade-alpha)))]">
          <Globe size={18} className="text-sky-100/95" strokeWidth={1.7}/>
          <span
              className="absolute -bottom-1 -right-1 flex size-[18px] items-center justify-center rounded-full border border-ink/[0.18] bg-emerald-400/90 shadow-[0_2px_6px_rgba(16,185,129,0.45)]">
            <Download size={10} strokeWidth={3} className="text-emerald-950"/>
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold tracking-tight text-ink-92">
            {t('auth.continueOffline')}
          </span>
          <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-45">
            {t('auth.continueOfflineDesc')}
          </span>
        </span>

        <ChevronRight
            size={16}
            className="shrink-0 text-ink-30 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-ink-70"
        />
      </span>
        </button>
    );
}
