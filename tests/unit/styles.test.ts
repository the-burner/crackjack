// The stylesheets' own rules: no colour is hard-coded, every custom property a
// rule uses exists, and every Classic colour has a Latte and a Mocha value.
//
// None of this is visible to the other tests: a property missing from one theme
// just inherits the Classic colour and looks wrong only to the eye.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

const DIR = 'src/ui/styles/';
const FILES = readdirSync(DIR).filter(name => name.endsWith('.css'));
const CSS = Object.fromEntries(FILES.map(name => [name, readFileSync(DIR + name, 'utf8')]));
const ALL = Object.values(CSS).join('\n');

const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
/**
 * The custom properties a stylesheet defines. Declarations are separated by
 * braces and semicolons, and several often share a line; a selector such as
 * `.btn--primary:active` must not be mistaken for one.
 */
const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '');

const definitions = (text: string) =>
  withoutComments(text)
    .split(/[;{}]/)
    .map(part => /^\s*(--[a-z0-9-]+)\s*:\s*(.+)$/s.exec(part))
    .filter(match => match !== null)
    .map(match => [match[0], match[1], match[2]]);

/** The custom properties a theme block sets. */
function themeBlock(name: string) {
  const start = ALL.indexOf(`[data-theme='${name}']`);
  expect(start, `no ${name} theme block`).toBeGreaterThan(-1);
  return new Set([...ALL.slice(start).matchAll(/(--[a-z0-9-]+)\s*:/g)].map(match => match[1]));
}

describe('custom properties', () => {
  it('are all defined somewhere before they are used', () => {
    const defined = new Set(definitions(ALL).map(match => match[1]));
    const used = new Set([...ALL.matchAll(/var\((--[a-z0-9-]+)/g)].map(match => match[1]));
    expect([...used].filter(name => !defined.has(name))).toEqual([]);
  });

  it('are all used somewhere, so none is left behind', () => {
    const used = new Set([...ALL.matchAll(/var\((--[a-z0-9-]+)/g)].map(match => match[1]));
    // Canvas code reads some of them by name instead.
    const fromScript = new Set<string>();
    for (const file of [
      'src/game/table/bet-grid.ts',
      'src/drills/shared/answer-grid.ts',
      'src/game/table/renderer.ts',
      'src/drills/full/screen.ts',
      'src/drills/depth/screen.ts',
      'src/drills/count/screen.ts',
      'src/game/screens/table.ts',
      'src/ui/theme.ts',
    ]) {
      for (const match of readFileSync(file, 'utf8').matchAll(/(--[a-z0-9-]+)/g)) fromScript.add(match[1]);
    }
    const defined = definitions(CSS['app.css']).map(match => match[1]);
    const unused = defined.filter(name => !used.has(name) && !fromScript.has(name) && !themeBlock('mocha').has(name));
    expect(unused).toEqual([]);
  });
});

/** Colours of the felt photograph's own artwork, the same in every theme. */
const FELT_ARTWORK_NAMES = ['--felt-fallback', '--bet-circle'];

describe('the themes', () => {
  const classicColours = () => {
    const names = new Set<string>();
    for (const [name, text] of Object.entries(CSS)) {
      if (name === 'themes.css') continue;
      for (const [, property, value] of definitions(text)) {
        if (COLOUR.test(value)) names.add(property);
      }
    }
    return [...names];
  };

  it('give Classic a literal colour for the ones they theme', () => {
    expect(classicColours().length).toBeGreaterThan(50);
  });

  for (const theme of ['latte', 'mocha']) {
    it(`map every Classic colour in ${theme}`, () => {
      const mapped = themeBlock(theme);
      expect(classicColours().filter(name => !mapped.has(name) && !FELT_ARTWORK_NAMES.includes(name))).toEqual([]);
    });
  }

  it('reach the palette through named roles, not raw hex, outside the palette block', () => {
    // Deliberately the same in both flavours, so they take a literal.
    const SHARED = ['--toggle-knob'];
    const themes = CSS['themes.css'];
    const roleSection = themes.slice(themes.indexOf('Shared role mapping'));
    const rawHex = [...roleSection.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*#[0-9a-fA-F]{3,8}\b/gm)]
      .map(match => match[1])
      .filter(name => !SHARED.includes(name));
    expect(rawHex).toEqual([]);
  });
});

describe('hard-coded colours', () => {
  /** A colour outside a custom-property definition cannot be themed. */
  const offenders = (text: string) =>
    text
      .split('\n')
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(({ line }) => COLOUR.test(line))
      .filter(({ line }) => !/^--[a-z0-9-]+\s*:/.test(line))
      // A mask is a stencil, not a colour: only its alpha matters.
      .filter(({ line }) => !line.includes('mask-image'));

  for (const name of FILES) {
    it(`${name} sets colours only through custom properties`, () => {
      expect(offenders(CSS[name]).map(hit => `${hit.number}: ${hit.line}`)).toEqual([]);
    });
  }
});

describe('type', () => {
  /** The project's weights are 400, 500 and 600; `bold` and 700 are not on it. */
  const SCALE = ['400', '500', '600'];
  const offScale = (text: string) =>
    withoutComments(text)
      .split('\n')
      .flatMap((line, index) =>
        [...line.matchAll(/font(?:-weight)?:\s*([a-z0-9]+)/g)]
          .map(match => match[1])
          .filter(weight => /^(bold|bolder|lighter|normal|\d00)$/.test(weight))
          .filter(weight => !SCALE.includes(weight))
          .map(weight => `${index + 1}: ${weight}`),
      );

  for (const name of FILES) {
    it(`${name} sets weights only from the project's scale`, () => {
      expect(offScale(CSS[name])).toEqual([]);
    });
  }
});

describe('canvas colours', () => {
  /**
   * Canvas code reads a custom property with a Classic fallback, so a literal
   * colour must always sit next to the name of the property it falls back from.
   * These two are the exceptions, and should be converted.
   */
  const KNOWN_LITERALS: Record<string, string[]> = {
    'src/game/table/renderer.ts': ['CIRCLE_COLOR', 'FELT_FALLBACK'],
  };

  const FILES_WITH_CANVAS = [
    'src/game/table/renderer.ts',
    'src/game/table/bet-grid.ts',
    'src/drills/shared/answer-grid.ts',
    'src/drills/shared/discard-tray.ts',
    'src/drills/full/screen.ts',
    'src/drills/depth/screen.ts',
    'src/drills/count/screen.ts',
  ];

  for (const file of FILES_WITH_CANVAS) {
    it(`${file.split('/').pop()} pairs every colour with a custom property`, () => {
      const allowed = KNOWN_LITERALS[file] ?? [];
      const bare = readFileSync(file, 'utf8')
        .split('\n')
        .map((line, index) => ({ line: line.trim(), number: index + 1 }))
        .filter(({ line }) => /'#[0-9a-fA-F]{3,8}'|'rgba?\(/.test(line))
        // The property name sits on the same line as its fallback.
        .filter(({ line }) => !line.includes('--'))
        .filter(({ line }) => !allowed.some(name => line.includes(name)));
      expect(bare.map(hit => `${hit.number}: ${hit.line}`)).toEqual([]);
    });
  }
});

describe('the table canvas', () => {
  const renderer = readFileSync('src/game/table/renderer.ts', 'utf8');

  /**
   * Colours of the felt artwork itself: the fill shown before the photograph
   * loads and the circles printed on it. The photograph is dark in every theme
   * by design, so these stay the same in all three.
   */
  const FELT_ARTWORK = ['--felt-fallback', '--bet-circle'];

  it('pairs every colour with the custom property it falls back from', () => {
    const bare = renderer
      .split('\n')
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(({ line }) => /'#[0-9a-fA-F]{3,8}'|'rgba?\(/.test(line))
      .filter(({ line }) => !line.includes('--'));
    expect(bare.map(hit => `${hit.number}: ${hit.line}`)).toEqual([]);
  });

  it('names properties the stylesheets define', () => {
    const defined = new Set(definitions(ALL).map(match => match[1]));
    const used = [...renderer.matchAll(/\['(--[a-z0-9-]+)',/g)].map(match => match[1]);
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter(name => !defined.has(name))).toEqual([]);
  });

  it('keeps the felt artwork out of the themes on purpose', () => {
    for (const name of FELT_ARTWORK) {
      expect(renderer).toContain(`'${name}'`);
    }
  });
});

describe('text that will not fit', () => {
  it('is ellipsised in a dropdown rather than cut mid-letter', () => {
    const rule = CSS['app.css'].match(/\.select select\s*\{[^}]*\}/)?.[0];
    expect(rule, 'no .select select rule').toBeDefined();
    expect(rule).toMatch(/text-overflow:\s*ellipsis/);
    // Ellipsis needs the overflow hidden and no wrapping to take effect.
    expect(rule).toMatch(/overflow:\s*hidden|white-space:\s*nowrap/);
  });
});
