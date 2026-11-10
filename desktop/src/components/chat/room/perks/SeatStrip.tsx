import { memo } from 'react';
import { usePerfMode } from '../../../../lib/perf';

type Seat = 'taken' | 'over' | 'free' | 'star';

const SEAT_CLASS: Record<Seat, string> = {
  taken: 'bg-accent',
  over: 'bg-amber-300',
  free: 'bg-ink/[0.12]',
  star: 'border border-dashed border-accent/70 bg-accent/[0.14]',
};

function seatOf(index: number, members: number, capacity: number): Seat {
  if (index < members) return index < capacity ? 'taken' : 'over';
  return index < capacity ? 'free' : 'star';
}

export const SeatStrip = memo(function SeatStrip({
  members,
  capacity,
  preview,
  height = 14,
}: {
  members: number;
  capacity: number;
  preview: number | null;
  height?: number;
}) {
  const perf = usePerfMode();
  const total = Math.max(preview ?? capacity, members, capacity);
  const seats = Array.from({ length: total }, (_, index) => ({
    id: `seat-${index}`,
    index,
    seat: seatOf(index, members, capacity),
  }));

  return (
    <div aria-hidden className="flex w-full items-end gap-[2px]" style={{ height }}>
      {seats.map(({ id, index, seat }) => {
        const extra = index >= capacity;
        const delay = (index - capacity) * 28;
        const wave = seat === 'star' && perf.idleAnim;
        return (
          <span
            key={id}
            className={`perk-motion h-full min-w-0 flex-1 origin-bottom rounded-full ${SEAT_CLASS[seat]}`}
            style={{
              animation: extra
                ? [
                    `perk-seat-in 0.42s var(--ease-apple) ${delay}ms both`,
                    wave ? `perk-seat-wave 2.6s ease-in-out ${900 + delay * 2}ms infinite` : null,
                  ]
                    .filter(Boolean)
                    .join(', ')
                : undefined,
              boxShadow:
                seat === 'taken' && perf.glow ? '0 0 8px -2px var(--color-accent-glow)' : undefined,
            }}
          />
        );
      })}
    </div>
  );
});
