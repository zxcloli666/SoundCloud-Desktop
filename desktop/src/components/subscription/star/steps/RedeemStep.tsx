import { useMutation } from '@tanstack/react-query';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { payApi } from '../../../../lib/pay-client';
import { requestPremiumRecheck } from '../../../../lib/premium-cache';
import { refreshShared, sharedErrorKey } from '../../../../lib/star-shared';
import { useFlowApi } from '../flow/derive';
import { BODY_LEN, CODE_RE, formatCode, parseCode, redeemErrorKey } from '../redeem-code';
import { Btn } from '../ui/Btn';
import { Title } from '../ui/Panel';

const CELLS = [0, 1, 2, 3];
const GROUP_COUNT = { star: 4, join: 3 } as const;

export const RedeemStep = memo(function RedeemStep() {
  const { t } = useTranslation();
  const api = useFlowApi();
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
      api.setStep('manage');
    },
  });

  const setCode = useCallback((raw: string) => {
    const parsed = parseCode(raw);
    setText(parsed.kind === 'join' ? `JOIN${parsed.body}` : parsed.body);
  }, []);

  const paste = async () => {
    try {
      setCode(await navigator.clipboard.readText());
      mutation.reset();
      inputRef.current?.focus();
    } catch {}
  };

  return (
    <div data-ui="star-redeem">
      <Title sub={t('starpass.shared.joinHint')}>{t('starpass.redeemTitle')}</Title>
      <div className="relative w-full cursor-text">
        <input
          aria-label={t('starpass.redeem.label')}
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => {
            setCode(e.target.value);
            mutation.reset();
          }}
          spellCheck={false}
          autoCapitalize="characters"
          autoFocus
          className="absolute inset-0 z-10 size-full cursor-text opacity-0"
        />
        <div className="flex select-none items-center gap-3">
          <span className="shrink-0 text-[15px] font-extrabold tracking-[0.06em] text-ink-45">
            {kind === 'join' ? 'JOIN' : 'STAR'}
          </span>
          {groups.map((g) => (
            <div key={g} className="flex min-w-0 flex-1 gap-1">
              {CELLS.map((c) => {
                const idx = g * 4 + c;
                const ch = body[idx];
                const active = idx === body.length && body.length < BODY_LEN[kind];
                return (
                  <div
                    key={c}
                    className="flex h-11 min-w-0 flex-1 items-center justify-center rounded-[10px] text-[16px] font-bold transition-[background-color,box-shadow] duration-150"
                    style={{
                      boxShadow: active
                        ? 'inset 0 0 0 1.5px var(--color-accent)'
                        : 'inset 0 0 0 1px rgb(var(--ink) / 0.10)',
                      background: ch ? 'rgb(var(--ink) / 0.06)' : 'rgb(var(--ink) / 0.02)',
                      color: ch ? 'rgb(var(--ink))' : 'rgb(var(--ink) / 0.2)',
                    }}
                  >
                    {ch ?? '·'}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {mutation.isError && (
        <div className="mt-3 text-[12.5px] text-bad">
          {t(kind === 'join' ? sharedErrorKey(mutation.error) : redeemErrorKey(mutation.error))}
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Btn
          tone="primary"
          size="lg"
          act="redeem-activate"
          onClick={() => mutation.mutate()}
          disabled={!valid || mutation.isPending}
        >
          {mutation.isPending ? t('starpass.redeem.activating') : t('starpass.redeem.activate')}
        </Btn>
        <Btn tone="quiet" onClick={() => void paste()}>
          {t('starpass.redeem.paste')}
        </Btn>
      </div>
    </div>
  );
});
