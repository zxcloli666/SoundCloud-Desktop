import { type KeyboardEvent, memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Hash, Plus, X } from '../../../lib/icons';
import { normalizeKeyword } from '../../../lib/keyword-filter';
import { useSettingsStore } from '../../../stores/settings';
import { Card } from '../primitives';

const SUGGESTIONS = ['nightcore', 'sped up', 'slowed', 'reverb', 'type beat', '8d audio'];
const MAX_KEYWORD_LENGTH = 60;

function cleanKeyword(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_KEYWORD_LENGTH);
}

const KeywordChip = memo(
  ({
    keyword,
    armed,
    onRemove,
  }: {
    keyword: string;
    armed: boolean;
    onRemove: (keyword: string) => void;
  }) => {
    const { t } = useTranslation();
    const ref = useRef<HTMLLIElement>(null);

    useEffect(() => {
      if (armed) ref.current?.scrollIntoView({ block: 'nearest' });
    }, [armed]);

    return (
      <li
        ref={ref}
        className={`group/chip inline-flex h-8 items-center gap-1 rounded-full border-[0.5px] pl-3 pr-1 text-[12.5px] font-medium transition-colors duration-200 ${
          armed
            ? 'border-rose-400/40 bg-rose-500/15 text-rose-200'
            : 'border-ink/[0.08] bg-ink/[0.04] text-ink-75 hover:border-ink/[0.14] hover:bg-ink/[0.07] hover:text-ink'
        }`}
      >
        <span className="max-w-[220px] truncate">{keyword}</span>
        <button
          type="button"
          onClick={() => onRemove(keyword)}
          aria-label={t('keywordFilter.remove', { keyword })}
          className="flex h-6 w-6 items-center justify-center rounded-full text-ink-35 transition-all duration-200 cursor-pointer hover:bg-rose-500/15 hover:text-rose-300 active:scale-90"
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      </li>
    );
  },
);

export function HiddenKeywordsCard() {
  const { t } = useTranslation();
  const keywords = useSettingsStore((s) => s.blockedKeywords);
  const setKeywords = useSettingsStore((s) => s.setBlockedKeywords);
  const [draft, setDraft] = useState('');
  const [armed, setArmed] = useState<string | null>(null);

  const taken = useMemo(() => new Set(keywords.map(normalizeKeyword)), [keywords]);
  const suggestions = SUGGESTIONS.filter((s) => !taken.has(normalizeKeyword(s)));
  const draftKey = normalizeKeyword(draft);
  const duplicate = draftKey !== '' && taken.has(draftKey);
  const last = keywords[keywords.length - 1];

  const add = (value: string) => {
    const keyword = cleanKeyword(value);
    const key = normalizeKeyword(keyword);
    if (!key || taken.has(key)) return;
    setKeywords([...keywords, keyword]);
  };

  const remove = (keyword: string) => setKeywords(keywords.filter((k) => k !== keyword));

  const submit = () => {
    if (duplicate) return;
    add(draft);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Backspace' && draft === '' && last !== undefined && !e.repeat) {
      if (armed === last) {
        remove(last);
        setArmed(null);
      } else {
        setArmed(last);
      }
    }
  };

  return (
    <Card
      title={t('keywordFilter.cardTitle')}
      desc={t('keywordFilter.cardDesc')}
      icon={<Hash size={17} />}
      action={
        keywords.length > 0 ? (
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border-[0.5px] border-ink/[0.12] bg-ink/[0.06] px-2.5 text-[12px] font-bold tabular-nums text-ink-70">
            {keywords.length}
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <div
          className={`flex h-11 items-center gap-2 rounded-2xl border-[0.5px] bg-ink/[0.03] pl-3.5 pr-1.5 transition-colors duration-200 focus-within:bg-ink/[0.05] ${
            duplicate
              ? 'border-amber-400/30'
              : 'border-ink/[0.08] focus-within:border-ink/[0.18]'
          }`}
        >
          <Hash size={14} className="shrink-0 text-ink-25" />
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setArmed(null);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => setArmed(null)}
            maxLength={MAX_KEYWORD_LENGTH}
            placeholder={t('keywordFilter.placeholder')}
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink-85 outline-none placeholder:text-ink-25"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!draftKey || duplicate}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3 text-[12px] font-semibold text-accent-contrast transition-all duration-200 cursor-pointer hover:brightness-110 active:scale-95 disabled:cursor-default disabled:bg-ink/[0.06] disabled:text-ink-30 disabled:active:scale-100"
          >
            <Plus size={13} strokeWidth={2.5} />
            {t('keywordFilter.add')}
          </button>
        </div>

        {duplicate && (
          <p className="-mt-2 text-[11.5px] text-amber-300/80">{t('keywordFilter.duplicate')}</p>
        )}

        {keywords.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-ink/[0.08] px-4 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/[0.04] text-ink-25">
              <Hash size={16} />
            </span>
            <p className="text-[12px] leading-snug text-ink-35">{t('keywordFilter.empty')}</p>
          </div>
        ) : (
          <ul className="flex max-h-[220px] flex-wrap gap-1.5 overflow-y-auto pr-1">
            {keywords.map((keyword) => (
              <KeywordChip
                key={keyword}
                keyword={keyword}
                armed={keyword === armed && keyword === last}
                onRemove={remove}
              />
            ))}
          </ul>
        )}

        {suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-25">
              {t('keywordFilter.suggestions')}
            </span>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                className="inline-flex h-7 items-center gap-1 rounded-full border-[0.5px] border-dashed border-ink/[0.12] px-2.5 text-[11.5px] font-medium text-ink-45 transition-all duration-200 cursor-pointer hover:border-ink/[0.24] hover:bg-ink/[0.04] hover:text-ink-80 active:scale-95"
              >
                <Plus size={11} />
                {s}
              </button>
            ))}
          </div>
        )}

        <p className="text-[11.5px] leading-snug text-ink-30">{t('keywordFilter.hint')}</p>
      </div>
    </Card>
  );
}
