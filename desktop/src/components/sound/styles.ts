export const CHIP =
  'flex h-7 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[11.5px] font-semibold tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-default disabled:opacity-35';

export const chip = (on: boolean) =>
  `${CHIP} ${
    on
      ? 'border-accent/40 bg-accent/[0.14] text-ink'
      : 'border-ink/[0.09] bg-ink/[0.03] text-ink-60 hover:border-ink/[0.18] hover:bg-ink/[0.07] hover:text-ink'
  }`;

export const ICON_BTN =
  'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-45 outline-none transition-colors hover:bg-ink/[0.07] hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/50';

export const LABEL = 'text-[12px] font-semibold text-ink-60';
