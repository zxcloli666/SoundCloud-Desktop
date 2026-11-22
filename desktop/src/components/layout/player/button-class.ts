export const playerBtn = (active: boolean, danger = false) =>
  `flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 hover:bg-ink/[0.07] disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent ${
    active
      ? danger
        ? 'text-bad'
        : 'text-accent'
      : 'text-ink-45 hover:text-ink disabled:hover:text-ink-45'
  }`;
