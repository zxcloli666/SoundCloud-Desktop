import { useMutation } from '@tanstack/react-query';
import { Fragment, memo, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { payApi } from '../../../lib/pay-client';
import { requestPremiumRecheck } from '../../../lib/premium-cache';
import { CODE_RE, formatCode, normalizeBody, redeemErrorKey } from './redeem-code';
import { LinkBtn, PrimaryBtn, Ttl } from './StarConsole';

const GROUPS = [0, 1, 2, 3];
const CELLS = [0, 1, 2, 3];

/** Redeem a STAR code — segmented cells (grey "X" placeholders) over a hidden input. */
export const RedeemPane = memo(function RedeemPane({ onRedeemed }: { onRedeemed: () => void }) {
  const { t } = useTranslation();
  const [body, setBody] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const code = useMemo(() => formatCode(body), [body]);
  const valid = CODE_RE.test(code);

  const mutation = useMutation({
    mutationFn: () => payApi.redeem(code),
    onSuccess: () => {
      requestPremiumRecheck();
      onRedeemed();
    },
  });

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setBody(normalizeBody(e.target.value));
      mutation.reset();
    },
    [mutation],
  );

  const onPaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setBody(normalizeBody(text));
      mutation.reset();
      inputRef.current?.focus();
    } catch {
      /* clipboard denied */
    }
  }, [mutation]);

  return (
    <div>
      <Ttl>{t('starpass.redeem.lead')}</Ttl>

      {/* segmented code field: cells render the value (or a grey X); a transparent
          full-cover input captures typing / paste / backspace (clicks land on it) */}
      <div className="relative w-full cursor-text">
        <input
          aria-label={t('starpass.redeem.label')}
          ref={inputRef}
          type="text"
          value={body}
          onChange={onChange}
          spellCheck={false}
          autoCapitalize="characters"
          autoFocus
          className="absolute inset-0 z-10 size-full cursor-text opacity-0"
        />
        <div className="flex select-none items-stretch gap-2">
          <span className="self-center font-mono text-[15px] tracking-[0.12em] text-ink-45">
            STAR
          </span>
          {GROUPS.map((g) => (
            <Fragment key={g}>
              <span className="self-center font-mono text-ink-25">–</span>
              <div className="flex flex-1 gap-1.5">
                {CELLS.map((c) => {
                  const idx = g * 4 + c;
                  const ch = body[idx];
                  const active = idx === body.length && body.length < 16;
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
          {t(redeemErrorKey(mutation.error))}
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
