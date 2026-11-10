import { splitMatches } from './matches';

export function Highlighted({ text, query }: { text: string; query: string }) {
  return splitMatches(text, query).map((piece, index) =>
    piece.hit ? (
      <span key={index} className="text-[var(--color-accent)]">
        {piece.text}
      </span>
    ) : (
      piece.text
    ),
  );
}
