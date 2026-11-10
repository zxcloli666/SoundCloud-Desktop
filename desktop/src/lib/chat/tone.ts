export function ink(percent: number): string {
  return `color-mix(in srgb, var(--tone-hi) ${percent}%, transparent)`;
}

export function surface(lift: number, opacity = 100): string {
  const solid = `color-mix(in srgb, var(--tone-hi) ${lift}%, var(--tone-lo))`;
  return opacity === 100 ? solid : `color-mix(in srgb, ${solid} ${opacity}%, transparent)`;
}
