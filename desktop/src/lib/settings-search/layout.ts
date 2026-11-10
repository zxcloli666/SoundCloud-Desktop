const LATIN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
const CYRILLIC = 'йцукенгшщзхъфывапролджэячсмитьбюё';

const SWAP = new Map<string, string>();
for (let index = 0; index < LATIN.length; index++) {
  SWAP.set(LATIN[index], CYRILLIC[index]);
  SWAP.set(CYRILLIC[index], LATIN[index]);
}

export function swapLayout(text: string): string {
  return [...text.toLowerCase()].map((char) => SWAP.get(char) ?? char).join('');
}
