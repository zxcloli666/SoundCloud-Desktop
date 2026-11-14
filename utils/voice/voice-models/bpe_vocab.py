import struct
import sys


def varint(raw, at):
    value = shift = 0
    while True:
        byte = raw[at]
        at += 1
        value |= (byte & 0x7F) << shift
        if byte < 0x80:
            return value, at
        shift += 7


def fields(raw):
    at = 0
    while at < len(raw):
        key, at = varint(raw, at)
        number, kind = key >> 3, key & 7
        if kind == 0:
            value, at = varint(raw, at)
        elif kind == 1:
            value, at = raw[at:at + 8], at + 8
        elif kind == 2:
            size, at = varint(raw, at)
            value, at = raw[at:at + size], at + size
        elif kind == 5:
            value, at = raw[at:at + 4], at + 4
        else:
            raise ValueError(kind)
        yield number, kind, value


def pieces(path):
    for number, kind, value in fields(open(path, 'rb').read()):
        if number != 1 or kind != 2:
            continue
        piece, score = '', 0.0
        for inner, inner_kind, inner_value in fields(value):
            if inner == 1:
                piece = inner_value.decode('utf-8')
            elif inner == 2:
                score = struct.unpack('<f', inner_value)[0]
        yield piece, score


with open(sys.argv[2], 'w', encoding='utf-8') as out:
    for piece, score in pieces(sys.argv[1]):
        out.write(f'{piece}\t{score}\n')
