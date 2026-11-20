export type Failure = 'busy' | 'down' | 'no_star' | 'lost';

export function failureOf(code: string): Failure {
  if (code === 'rate_limited') return 'busy';
  if (code === 'unavailable') return 'down';
  if (code === 'star_required') return 'no_star';
  return 'lost';
}
