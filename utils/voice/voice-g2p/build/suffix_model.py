import collections

VOWELS = "аеёиоуыэюя"


def vowel_from_end(word, pos):
    return sum(1 for c in word[pos + 1:] if c in VOWELS)


def train(stress):
    votes = collections.defaultdict(collections.Counter)
    test = []
    for word, positions in stress.items():
        d = vowel_from_end(word, positions[0])
        if sum(ord(c) * 31 ** i for i, c in enumerate(word[:6])) % 10 == 0:
            test.append((word, d))
            continue
        for n in range(1, 6):
            if len(word) > n:
                votes[word[-n:]][d] += 1

    rules = {}
    for suffix in sorted(votes, key=len):
        c = votes[suffix]
        total = sum(c.values())
        best, hits = c.most_common(1)[0]
        if total < 6 or hits / total < 0.55:
            continue
        parent = None
        for n in range(len(suffix) - 1, 0, -1):
            if suffix[-n:] in rules:
                parent = rules[suffix[-n:]]
                break
        if parent == best and hits / total < 0.9:
            continue
        rules[suffix] = best

    def predict(word):
        for n in range(5, 0, -1):
            if len(word) > n and word[-n:] in rules:
                return rules[word[-n:]]
        return 1

    right = sum(1 for word, d in test if predict(word) == d)
    return rules, right, len(test)
