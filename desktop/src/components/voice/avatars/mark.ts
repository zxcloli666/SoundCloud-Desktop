import type { CSSProperties } from 'react';

export interface MarkProps {
  uid: string;
  idle: boolean;
}

export function sparkle(x: number, y: number, r: number): string {
  return `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;
}

export function stop(color: string): CSSProperties {
  return { stopColor: color };
}

export function motion(
  idle: boolean,
  animation: string,
  origin: string,
): CSSProperties | undefined {
  return idle ? { animation, transformOrigin: origin } : undefined;
}
