import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import ts from 'typescript';

export function parseFile(path) {
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, kind);
}

export function readImports(source) {
  const imports = new Map();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
    const file = resolveImport(source.fileName, statement.moduleSpecifier.text);
    if (!file) continue;
    const { name, namedBindings } = statement.importClause;
    if (name) imports.set(name.text, { file, imported: 'default' });
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const element of namedBindings.elements) {
        imports.set(element.name.text, {
          file,
          imported: (element.propertyName ?? element.name).text,
        });
      }
    }
  }
  return imports;
}

export function jsxOpening(node) {
  if (ts.isJsxElement(node)) return node.openingElement;
  if (ts.isJsxSelfClosingElement(node)) return node;
  return null;
}

export function attributeValue(opening, name) {
  const attribute = opening.attributes.properties.find(
    (property) => ts.isJsxAttribute(property) && property.name.text === name,
  );
  return attribute?.initializer;
}

export function where(root, source, node) {
  const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  return `${relative(root, source.fileName)}:${line}`;
}

export function keysIn(node, keyIndex, report) {
  const keys = [];
  const visit = (child) => {
    keys.push(...literalKeys(child, keyIndex, report));
    ts.forEachChild(child, visit);
  };
  visit(node);
  return keys;
}

export function literalKeys(node, keyIndex, report) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return keyIndex.has(node.text) ? [node.text] : [];
  }
  if (!ts.isTemplateExpression(node)) return [];
  const head = node.head.text;
  if (head.length < 3) return [];
  const tail = node.templateSpans[node.templateSpans.length - 1].literal.text;
  const keys = keyIndex.expand(head, tail);
  if (keys.length > keyIndex.broadLimit) {
    report(node, `template "${head}..." expands to ${keys.length} keys`);
    return [];
  }
  return keys;
}

function resolveImport(from, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = join(dirname(from), specifier);
  for (const tail of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
    if (existsSync(base + tail)) return base + tail;
  }
  return null;
}
