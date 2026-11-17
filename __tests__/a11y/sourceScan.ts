import ts from 'typescript';

import { theme } from '@/theme';

// Jest runs in Node, but the app's tsconfig carries no Node types: the little this needs is typed by hand.
declare const __dirname: string;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- typed by hand; no Node types to import with
const { readdirSync, readFileSync, statSync } = require('fs') as {
  readdirSync: (path: string) => string[];
  readFileSync: (path: string, encoding: 'utf8') => string;
  statSync: (path: string) => { isDirectory: () => boolean };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports -- as above
const { join, relative } = require('path') as {
  join: (...parts: string[]) => string;
  relative: (from: string, to: string) => string;
};

const REPO = join(__dirname, '..', '..');

/** Every `.tsx` file under `dir` (relative to the repo root), as `{ path, source }`. */
export function tsxFiles(dir: string): { path: string; source: string }[] {
  const walk = (current: string): string[] =>
    readdirSync(current).flatMap((name) => {
      const full = join(current, name);
      if (statSync(full).isDirectory()) {
        return walk(full);
      }
      return name.endsWith('.tsx') ? [full] : [];
    });
  return walk(join(REPO, dir)).map((full) => ({
    path: relative(REPO, full).replace(/\\/g, '/'),
    source: readFileSync(full, 'utf8'),
  }));
}

export interface JsxUse {
  path: string;
  line: number;
  tag: string;
  /** Attribute name → source text of its initializer (`true` for a bare attribute). */
  attrs: Record<string, string>;
  /** Source text of the whole element, children included. */
  text: string;
  /** Whether the element's subtree holds a `<Text>`. */
  hasText: boolean;
  /** Whether a spread (`{...props}`) could supply anything. */
  spreads: boolean;
  /** The styles declared in the file's `StyleSheet.create`, by key. */
  styles: Record<string, StyleInfo>;
}

export interface StyleInfo {
  typography: string | null;
  dims: Partial<Record<'height' | 'width' | 'minHeight' | 'minWidth', number>>;
}

/** Evaluates a style value made of numbers and `theme.…` tokens; `null` when it is anything else. */
function evaluate(expression: string): number | null {
  if (!/^[\w\s.+\-*/()]+$/.test(expression)) {
    return null;
  }
  try {
    const value = new Function('theme', `return (${expression});`)(theme) as unknown;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function styleSheetOf(sf: ts.SourceFile): Record<string, StyleInfo> {
  const styles: Record<string, StyleInfo> = {};
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(sf) === 'StyleSheet.create') {
      const object = node.arguments[0];
      if (object && ts.isObjectLiteralExpression(object)) {
        for (const property of object.properties) {
          if (
            !ts.isPropertyAssignment(property) ||
            !ts.isObjectLiteralExpression(property.initializer)
          ) {
            continue;
          }
          const info: StyleInfo = { typography: null, dims: {} };
          for (const entry of property.initializer.properties) {
            if (ts.isSpreadAssignment(entry)) {
              const match = /theme\.typography\.(\w+)/.exec(entry.expression.getText(sf));
              if (match) {
                info.typography = match[1] ?? null;
              }
            } else if (ts.isPropertyAssignment(entry)) {
              const key = entry.name.getText(sf);
              if (
                key === 'height' ||
                key === 'width' ||
                key === 'minHeight' ||
                key === 'minWidth'
              ) {
                const value = evaluate(entry.initializer.getText(sf));
                if (value !== null) {
                  info.dims[key] = value;
                }
              }
            }
          }
          styles[property.name.getText(sf)] = info;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return styles;
}

/** Every JSX element whose tag is one of `tags`, with its attributes. */
export function jsxUses(
  files: { path: string; source: string }[],
  tags: readonly string[],
): JsxUse[] {
  const uses: JsxUse[] = [];
  for (const { path, source } of files) {
    const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const styles = styleSheetOf(sf);
    const visit = (node: ts.Node) => {
      const opening = ts.isJsxElement(node)
        ? node.openingElement
        : ts.isJsxSelfClosingElement(node)
          ? node
          : null;
      if (opening && tags.includes(opening.tagName.getText(sf))) {
        const attrs: Record<string, string> = {};
        let spreads = false;
        for (const attribute of opening.attributes.properties) {
          if (ts.isJsxAttribute(attribute)) {
            attrs[attribute.name.getText(sf)] = attribute.initializer
              ? attribute.initializer.getText(sf)
              : 'true';
          } else {
            spreads = true;
          }
        }
        let hasText = false;
        const find = (child: ts.Node) => {
          if (
            (ts.isJsxElement(child) && child.openingElement.tagName.getText(sf) === 'Text') ||
            (ts.isJsxSelfClosingElement(child) && child.tagName.getText(sf) === 'Text')
          ) {
            hasText = true;
          }
          ts.forEachChild(child, find);
        };
        find(node);
        uses.push({
          path,
          line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
          tag: opening.tagName.getText(sf),
          attrs,
          text: node.getText(sf),
          hasText,
          spreads,
          styles,
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return uses;
}

/** The size of a use along one axis: the style's height/minHeight (or width/minWidth) plus the hit slop on both sides. */
export function reach(use: JsxUse, axis: 'vertical' | 'horizontal'): number | null {
  const keys = [...(use.attrs.style ?? '').matchAll(/styles\.(\w+)/g)].map((match) => match[1]);
  const size: number[] = [];
  for (const key of keys) {
    const dims = use.styles[key ?? '']?.dims ?? {};
    const own = axis === 'vertical' ? [dims.height, dims.minHeight] : [dims.width, dims.minWidth];
    size.push(...own.filter((value): value is number => value !== undefined));
  }
  if (size.length === 0) {
    return null;
  }
  const slop = use.attrs.hitSlop ?? '';
  let extra = 0;
  if (slop.startsWith('{{')) {
    const sides = axis === 'vertical' ? ['top', 'bottom'] : ['left', 'right'];
    for (const side of sides) {
      const match = new RegExp(`${side}:\\s*([^,}]+)`).exec(slop);
      extra += match ? (evaluate((match[1] ?? '').trim()) ?? 0) : 0;
    }
  } else if (slop) {
    extra = 2 * (evaluate(slop.replace(/^\{|\}$/g, '').trim()) ?? 0);
  }
  return Math.max(...size) + extra;
}

/** Title-sized `Text` elements (display, title, heading, subhead) that lack a header role, as `path:styleKey`. */
export function headingsWithoutRole(files: { path: string; source: string }[]): string[] {
  const found: string[] = [];
  for (const use of jsxUses(files, ['Text'])) {
    if ('accessibilityRole' in use.attrs || 'role' in use.attrs) {
      continue;
    }
    for (const match of (use.attrs.style ?? '').matchAll(/styles\.(\w+)/g)) {
      const key = match[1] ?? '';
      if (['display', 'title', 'heading', 'subhead'].includes(use.styles[key]?.typography ?? '')) {
        found.push(`${use.path}:${key}`);
        break;
      }
    }
  }
  return found;
}
