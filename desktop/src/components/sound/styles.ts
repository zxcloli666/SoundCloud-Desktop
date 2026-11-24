export const CHIP =
  'flex h-7 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[11.5px] font-semibold tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-default disabled:opacity-35';

export const chip = (on: boolean) =>
  `${CHIP} ${
    on
      ? 'border-accent/40 bg-accent/[0.14] text-ink'
      : 'border-ink/[0.09] bg-ink/[0.03] text-ink-60 hover:border-ink/[0.18] hover:bg-ink/[0.07] hover:text-ink'
  }`;

export const ICON_BTN =
  'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-45 outline-none transition-colors hover:bg-ink/[0.07] hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-default disabled:opacity-35 aria-pressed:bg-ink/[0.1] aria-pressed:text-ink';

export const LABEL = 'text-[12px] font-semibold text-ink-60';

export const SUBMIT_BTN =
  'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-accent-contrast outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-default disabled:opacity-35';

export const FIELD =
  'border border-ink/[0.09] bg-ink/[0.03] text-ink-85 outline-none transition-colors placeholder:text-ink-30 focus-within:border-ink/[0.22] focus-within:bg-ink/[0.05]';

export const GAIN = 'text-center text-[11px] font-semibold leading-[14px] tabular-nums';
export const BAND = 'text-center text-[10px] font-medium leading-[14px] tabular-nums';
