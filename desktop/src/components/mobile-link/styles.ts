export const PRIMARY_BUTTON =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-[12.5px] font-semibold cursor-pointer bg-accent text-accent-contrast transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:opacity-40 disabled:cursor-not-allowed';

export const QUIET_BUTTON =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-semibold cursor-pointer bg-ink/[0.04] text-ink-70 border border-ink/[0.06] transition-colors hover:bg-ink/[0.08] hover:text-ink-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:opacity-40 disabled:cursor-not-allowed';

export type Tone = 'busy' | 'ok' | 'warn' | 'bad' | 'idle';

export const TONE_CLASS: Record<Tone, string> = {
  busy: 'bg-[var(--color-accent-glow)] text-[var(--color-accent)] border-[var(--color-accent)]/30',
  ok: 'bg-emerald-500/12 text-emerald-500 border-emerald-500/30',
  warn: 'bg-amber-500/12 text-amber-500 border-amber-500/30',
  bad: 'bg-red-500/12 text-red-500 border-red-500/30',
  idle: 'bg-ink/[0.05] text-ink-45 border-ink/[0.08]',
};
