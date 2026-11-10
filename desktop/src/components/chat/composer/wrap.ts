export interface Wrapped {
  text: string;
  start: number;
  end: number;
}

export function wrapSelection(input: HTMLTextAreaElement, token: string): Wrapped {
  const { value, selectionStart, selectionEnd } = input;
  const selected = value.slice(selectionStart, selectionEnd);
  const text =
    value.slice(0, selectionStart) + token + selected + token + value.slice(selectionEnd);
  const start = selectionStart + token.length;
  return { text, start, end: start + selected.length };
}
