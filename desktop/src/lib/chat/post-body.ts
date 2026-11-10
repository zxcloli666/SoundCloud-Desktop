const PAD_BLOCK = 256;
const VERSION_BYTES = 2;
const encoder = new TextEncoder();

function varintLen(value: number): number {
  let length = 1;
  for (let rest = value; rest >= 0x80; rest = Math.floor(rest / 0x80)) length += 1;
  return length;
}

function field(bytes: number): number {
  return 1 + varintLen(bytes) + bytes;
}

function padded(unpadded: number): number {
  let target = Math.ceil((unpadded + 3) / PAD_BLOCK) * PAD_BLOCK;
  for (;;) {
    for (const prefix of [2, 3]) {
      if (1 + varintLen(target - unpadded - prefix) === prefix) return target;
    }
    target += PAD_BLOCK;
  }
}

function bodyLen(textBytes: number): number {
  return padded(VERSION_BYTES + field(field(textBytes)));
}

export function textBytes(text: string): number {
  return encoder.encode(text).length;
}

export function postBodyLen(text: string): number {
  return text.trim() === '' ? 0 : bodyLen(textBytes(text));
}

export function textRoom(bodyMax: number): number {
  let low = 0;
  let high = bodyMax;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (bodyLen(middle) <= bodyMax) low = middle;
    else high = middle - 1;
  }
  return low;
}
