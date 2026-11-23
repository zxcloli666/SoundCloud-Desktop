import type { ReadingsAnswer } from '../library-readings.ts';

export interface SingleReadingsAnswer {
  readings: { name: string; said: string | string[] }[];
  left: number;
}

export function listedReadings(answer: SingleReadingsAnswer): ReadingsAnswer {
  const readings = answer.readings.map(({ name, said }) => ({
    name,
    said: typeof said === 'string' ? [said] : said,
  }));
  return { readings, left: answer.left };
}
