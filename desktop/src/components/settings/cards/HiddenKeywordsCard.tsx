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
        className={`group/chip inline-flex h-8 items-center gap-1 rounded-full border pr-1 pl-3 text-[12.5px] font-medium transition-colors duration-150 ${
          armed
            ? 'border-bad/40 bg-bad/15 text-bad'
            : 'border-[color:var(--set-line)] bg-[var(--set-well)] text-ink-80 hover:bg-[var(--set-well-hi)] hover:text-ink'
        }`}
      >
        <span className="max-w-[220px] truncate">{keyword}</span>
        <button
          type="button"
          onClick={() => onRemove(keyword)}
          aria-label={t('keywordFilter.remove', { keyword })}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-ink-35 transition-colors duration-150 hover:bg-bad/15 hover:text-bad"
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
      info={t('keywordFilter.hint')}
      icon={<Hash size={17} />}
      action={
        keywords.length > 0 ? (
          <span className="set-chip h-7 min-w-7 justify-center px-2.5">{keywords.length}</span>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3.5">
        <div
          className={`flex h-10 items-center gap-2 rounded-[11px] border bg-[var(--set-well)] pr-1 pl-3 transition-colors duration-150 ${
            duplicate
              ? 'border-amber-400/60'
              : 'border-[color:var(--set-line)] focus-within:border-accent'
          }`}
        >
          <Hash size={14} className="shrink-0 text-ink-35" />
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
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink-90 outline-none placeholder:text-ink-35"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!draftKey || duplicate}
            className="set-btn"
            data-tone="accent"
          >
            <Plus size={13} strokeWidth={2.5} />
            {t('keywordFilter.add')}
          </button>
        </div>

        {duplicate && (
          <p className="-mt-1.5 text-[11.5px] text-amber-400">{t('keywordFilter.duplicate')}</p>
        )}

        {keywords.length === 0 ? (
          <p className="text-[12.5px] leading-snug text-ink-40">{t('keywordFilter.empty')}</p>
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
            <span className="mr-1 text-[12px] text-ink-40">{t('keywordFilter.suggestions')}</span>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-dashed border-[color:var(--shell-line-hi)] px-2.5 text-[12px] font-medium text-ink-55 transition-colors duration-150 hover:bg-[var(--set-well)] hover:text-ink"
              >
                <Plus size={11} />
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
