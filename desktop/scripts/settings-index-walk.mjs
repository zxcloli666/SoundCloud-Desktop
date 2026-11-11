import ts from 'typescript';
import {
  attributeValue,
  jsxOpening,
  keysIn,
  literalKeys,
  parseFile,
  readImports,
  where,
} from './settings-index-parse.mjs';

export function walkFile(ctx, file, host, stack, direct) {
  const source = parseFile(file);
  const imports = readImports(source);
  const report = (node, text) => ctx.problems.push(`${where(ctx.root, source, node)}: ${text}`);
  const found = collect(ctx, source, imports, report);

  const cards = found.scopes.filter((scope) => scope.type === 'Card');
  const customTitle = ctx.customCards.get(ctx.relative(file));
  if (!host && cards.length === 0 && !customTitle) {
    if (direct) ctx.problems.push(`${ctx.relative(file)}: no card and no host`);
    return;
  }
  for (const scope of cards) scope.entry = openEntry(ctx, scope, 'card', null, report);
  let onlyCard = cards.length === 1 && cards[0].entry ? cards[0].entry : null;
  if (customTitle && cards.length === 0) {
    onlyCard = openEntry(
      ctx,
      { type: 'Card', node: source, title: [customTitle], desc: [] },
      'card',
      null,
      report,
    );
  }

  for (const scope of found.scopes.filter((item) => item.type !== 'Card')) {
    const card = innermost(cards, scope.node.getStart())?.entry ?? onlyCard ?? host?.card;
    if (!card) {
      report(scope.node, 'Row outside any card');
      continue;
    }
    scope.card = card;
    scope.entry = openEntry(ctx, scope, 'row', card, report);
  }

  const withEntry = found.scopes.filter((scope) => scope.entry);
  for (const literal of found.literals) {
    const position = literal.node.getStart();
    if (found.scopes.some((scope) => inside(scope.attributes, position))) continue;
    const owner = innermost(withEntry, position)?.entry ?? onlyCard ?? host?.row ?? host?.card;
    if (!owner) {
      report(literal.node, `${literal.keys[0]} belongs to no card`);
      continue;
    }
    owner.keys.push(...literal.keys);
  }

  for (const scope of withEntry.filter((item) => item.type !== 'Card')) {
    scope.entry.keys.push(...constKeys(scope.node, found.consts, ctx.keyIndex, report));
  }

  for (const tag of found.tags) {
    if (!ctx.walkable(tag.file) || stack.includes(tag.file) || tag.file === file) continue;
    const position = tag.node.getStart();
    const scope = innermost(withEntry, position);
    const next = scope
      ? {
          card: scope.type === 'Card' ? scope.entry : scope.card,
          row: scope.type !== 'Card' ? scope.entry : null,
        }
      : onlyCard
        ? { card: onlyCard, row: null }
        : host;
    walkFile(ctx, tag.file, next, [...stack, file], false);
  }
}

function collect(ctx, source, imports, report) {
  const found = { scopes: [], tags: [], literals: [], consts: new Map() };
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      found.consts.set(node.name.text, [
        ...(found.consts.get(node.name.text) ?? []),
        node.initializer,
      ]);
    }
    const opening = jsxOpening(node);
    const binding =
      opening && ts.isIdentifier(opening.tagName) ? imports.get(opening.tagName.text) : null;
    if (
      binding?.file === ctx.primitives &&
      (binding.imported === 'Card' || binding.imported === 'Row')
    ) {
      found.scopes.push(openScope(ctx, binding.imported, node, opening, report));
    } else if (opening && isMarked(opening)) {
      found.scopes.push(openMarked(ctx, node, report));
    }
    if (binding && binding.file !== ctx.primitives) found.tags.push({ node, file: binding.file });
    const keys = literalKeys(node, ctx.keyIndex, report);
    if (keys.length > 0) found.literals.push({ node, keys });
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function isMarked(opening) {
  const value = attributeValue(opening, 'data-ui');
  return value !== undefined && ts.isStringLiteral(value) && value.text === 'settings-row';
}

function openMarked(ctx, node, report) {
  return {
    type: 'Marked',
    node,
    title: keysIn(node, ctx.keyIndex, report).slice(0, 1),
    desc: [],
    attributes: [],
  };
}

function openScope(ctx, type, node, opening, report) {
  const title = attributeValue(opening, 'title');
  const desc = attributeValue(opening, 'desc');
  return {
    type,
    node,
    title: title ? keysIn(title, ctx.keyIndex, report) : [],
    desc: desc ? keysIn(desc, ctx.keyIndex, report) : [],
    attributes: [title, desc].filter(Boolean),
  };
}

function openEntry(ctx, scope, kind, card, report) {
  if (scope.title.length === 0) {
    if (isListItem(scope.node)) return null;
    report(scope.node, `${scope.type} title has no i18n key`);
    return null;
  }
  const entry = {
    id: scope.title[0],
    kind,
    category: ctx.category,
    card: card?.id ?? scope.title[0],
    title: scope.title,
    desc: scope.desc,
    keys: [],
    marked: scope.type === 'Marked',
  };
  if (ctx.hidden.has(entry.id)) return entry;
  const known = ctx.entries.get(entry.id);
  if (!known) {
    ctx.entries.set(entry.id, entry);
    return entry;
  }
  if (known.category !== entry.category) {
    report(scope.node, `${entry.id} already belongs to ${known.category}`);
    return entry;
  }
  known.title.push(...entry.title);
  known.desc.push(...entry.desc);
  return known;
}

function isListItem(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isCallExpression(parent) && parent.expression.getText().endsWith('.map')) return true;
  }
  return false;
}

function constKeys(row, consts, keyIndex, report) {
  const keys = [];
  const seen = new Set();
  const pending = [row];
  while (pending.length > 0) {
    const visit = (node) => {
      if (ts.isIdentifier(node) && consts.has(node.text) && !seen.has(node.text)) {
        seen.add(node.text);
        for (const initializer of consts.get(node.text)) {
          keys.push(...keysIn(initializer, keyIndex, report));
          pending.push(initializer);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(pending.pop());
  }
  return keys;
}

function innermost(scopes, position) {
  let best = null;
  for (const scope of scopes) {
    if (!inside(scope.node, position)) continue;
    if (!best || scope.node.end - scope.node.getStart() < best.node.end - best.node.getStart()) {
      best = scope;
    }
  }
  return best;
}

function inside(nodes, position) {
  return [nodes].flat().some((node) => position >= node.getStart() && position < node.end);
}
