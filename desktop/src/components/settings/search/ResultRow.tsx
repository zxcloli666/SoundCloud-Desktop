import { memo, type ReactNode } from 'react';
import type { SettingsResult } from '../../../lib/settings-search/useSettingsSearch';
import { ChevronRight } from '../../../lib/icons';
import { Highlighted } from './Highlighted';

const LIT = {
  background:
    'linear-gradient(180deg, var(--color-accent-glow), transparent), rgb(var(--ink) / 0.06)',
  boxShadow: '0 0 22px var(--color-accent-glow), inset 0 0.5px 0 rgba(255,255,255,0.16)',
};

export const ResultRow = memo(function ResultRow({
  id,
  result,
  icon,
  query,
  on,
  onActive,
  onChoose,
}: {
  id: string;
  result: SettingsResult;
  icon: ReactNode;
  query: string;
  on: boolean;
  onActive: () => void;
  onChoose: () => void;
}) {
  const section = result.kind === 'section';
  return (
    <button
      type="button"
      id={id}
      role="option"
      aria-selected={on}
      data-ui="settings-search-result"
      data-kind={result.kind}
      data-active={on ? 'true' : undefined}
      onMouseMove={on ? undefined : onActive}
      onClick={onChoose}
      style={on ? LIT : undefined}
      className="relative flex w-full cursor-pointer items-center gap-3.5 rounded-2xl py-3 pl-3.5 pr-3 text-left transition-[background-color,box-shadow] duration-200"
    >
      {on && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full"
          style={{ background: 'var(--color-accent)', boxShadow: '0 0 10px var(--color-accent)' }}
        />
      )}
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          section ? 'text-accent-contrast' : 'text-[var(--color-accent)]'
        }`}
        style={
          section
            ? {
                background: 'var(--color-accent)',
                boxShadow:
                  '0 0 18px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.28)',
              }
            : {
                background:
                  'linear-gradient(135deg, var(--color-accent-glow), rgb(var(--ink) / 0.04))',
                border: '0.5px solid var(--color-accent-glow)',
                boxShadow:
                  '0 0 18px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.18)',
              }
        }
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[14px] text-ink-85 ${section ? 'font-bold' : 'font-semibold'}`}
        >
          <Highlighted text={result.title} query={query} />
        </span>
        {!section && (
          <span className="mt-0.5 block truncate text-[11px] font-medium text-ink-35">
            {result.path}
          </span>
        )}
        {result.desc !== '' && (
          <span className="mt-1 line-clamp-1 text-[12px] text-ink-45">
            {result.descMatched ? <Highlighted text={result.desc} query={query} /> : result.desc}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-[0.5px] text-[12px] transition-opacity duration-200 ${
          on ? 'border-ink/[0.14] bg-ink/[0.06] text-ink-60' : 'border-transparent text-ink-40'
        } ${on || section ? 'opacity-100' : 'opacity-0'}`}
      >
        {section && !on ? <ChevronRight size={16} /> : '↵'}
      </span>
    </button>
  );
});
