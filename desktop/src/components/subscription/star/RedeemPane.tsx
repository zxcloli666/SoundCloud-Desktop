import { useMutation } from '@tanstack/react-query';
import { Fragment, memo, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { payApi } from '../../../lib/pay-client';
import { requestPremiumRecheck } from '../../../lib/premium-cache';
import { refreshShared, sharedErrorKey } from '../../../lib/star-shared';
import { BODY_LEN, CODE_RE, formatCode, parseCode, redeemErrorKey } from './redeem-code';
import { LinkBtn, PrimaryBtn, Ttl } from './StarConsole';

const CELLS = [0, 1, 2, 3];
const GROUP_COUNT = { star: 4, join: 3 } as const;

/** Redeem a STAR code — segmented cells (grey "X" placeholders) over a hidden input. */
export const RedeemPane = memo(function RedeemPane({ onRedeemed }: { onRedeemed: () => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { kind, body } = useMemo(() => parseCode(text), [text]);
  const code = useMemo(() => formatCode(kind, body), [kind, body]);
  const valid = CODE_RE[kind].test(code);
  const groups = Array.from({ length: GROUP_COUNT[kind] }, (_, g) => g);

  const mutation = useMutation({
    mutationFn: async () => {
      await (kind === 'join' ? payApi.joinShared(code) : payApi.redeem(code));
    },
    onSuccess: () => {
      if (kind === 'join') refreshShared();
      requestPremiumRecheck();
      onRedeemed();
    },
  });

  const setCode = useCallback((raw: string) => {
    const parsed = parseCode(raw);
    setText(parsed.kind === 'join' ? `JOIN${parsed.body}` : parsed.body);
  }, []);

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCode(e.target.value);
      mutation.reset();
    },
    [mutation, setCode],
  );

  const onPaste = useCallback(async () => {
    try {
      const clip = await navigator.clipboard.readText();
      setCode(clip);
      mutation.reset();
      inputRef.current?.focus();
    } catch {
      /* clipboard denied */
    }
  }, [mutation, setCode]);

  return (
    <div>
      <Ttl>{t('starpass.redeem.lead')}</Ttl>
      <p className="-mt-2 mb-3 text-[11.5px] text-ink-40">{t('starpass.shared.joinHint')}</p>

      {/* segmented code field: cells render the value (or a grey X); a transparent
          full-cover input captures typing / paste / backspace (clicks land on it) */}
      <div className="relative w-full cursor-text">
        <input
          aria-label={t('starpass.redeem.label')}
          ref={inputRef}
          type="text"
          value={text}
          onChange={onChange}
          spellCheck={false}
          autoCapitalize="characters"
          autoFocus
          className="absolute inset-0 z-10 size-full cursor-text opacity-0"
        />
        <div className="flex select-none items-stretch gap-2">
          <span className="self-center font-mono text-[15px] tracking-[0.12em] text-ink-45">
            {kind === 'join' ? 'JOIN' : 'STAR'}
          </span>
          {groups.map((g) => (
            <Fragment key={g}>
              <span className="self-center font-mono text-ink-25">–</span>
              <div className="flex flex-1 gap-1.5">
                {CELLS.map((c) => {
                  const idx = g * 4 + c;
                  const ch = body[idx];
                  const active = idx === body.length && body.length < BODY_LEN[kind];
                  return (
                    <div
                      key={c}
                      className="flex aspect-square flex-1 items-center justify-center rounded-[9px] border font-mono text-[16px] transition-colors duration-150"
                      style={{
                        borderColor: active
                          ? 'var(--color-accent)'
                          : ch
                            ? 'rgb(var(--ink) / 0.22)'
                            : 'rgb(var(--ink) / 0.10)',
                        background: ch ? 'rgb(var(--ink) / 0.05)' : 'transparent',
                        color: ch ? 'rgb(var(--ink))' : 'rgb(var(--ink) / 0.22)',
                        boxShadow: active ? '0 0 16px -4px var(--color-accent-glow)' : undefined,
                      }}
                    >
                      {ch ?? 'X'}
                    </div>
                  );
                })}
              </div>
            </Fragment>
          ))}
        </div>
      </div>

      {mutation.isError && (
        <div className="mt-2.5 text-[12.5px] text-red-300/95">
          {t(kind === 'join' ? sharedErrorKey(mutation.error) : redeemErrorKey(mutation.error))}
        </div>
      )}
      <div className="mt-[18px] flex flex-wrap items-center gap-3">
        <PrimaryBtn onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}>
          {mutation.isPending ? t('starpass.redeem.activating') : t('starpass.redeem.activate')}
        </PrimaryBtn>
        <LinkBtn onClick={onPaste}>{t('starpass.redeem.paste')}</LinkBtn>
      </div>
    </div>
  );
});
