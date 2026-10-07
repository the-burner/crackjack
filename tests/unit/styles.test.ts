// The colour tokens' own rules: every custom property used exists, every
// Classic colour has a Latte and a Mocha value, no component hard-codes a
// colour, and no token is left behind.
//
// None of this is visible to the other tests: a property missing from one theme
// just inherits the Classic colour and looks wrong only to the eye.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '');

const TOKENS = withoutComments(readFileSync('src/styles/tokens.css', 'utf8'));
const THEMES = withoutComments(readFileSync('src/styles/themes.css', 'utf8'));
const INDEX = withoutComments(readFileSync('src/index.css', 'utf8'));
const CSS = [TOKENS, THEMES, INDEX].join('\n');

const SOURCES = readdirSync('src', { recursive: true, encoding: 'utf8' })
  .filter(name => /\.tsx?$/.test(name))
  .map(name => `src/${name}`);
const SOURCE = Object.fromEntries(SOURCES.map(file => [file, readFileSync(file, 'utf8')]));
const SCRIPT = Object.values(SOURCE).join('\n');

const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/;

/**
 * `--name: value` declarations. Declarations are separated by braces and
 * semicolons, and several often share a line.
 */
const definitions = (text: string) =>
  text
    .split(/[;{}]/)
    .map(part => /^\s*(--[a-z0-9-]+)\s*:\s*(.+)$/s.exec(part))
    .filter(match => match !== null)
    .map(match => ({ name: match[1], value: match[2].trim() }));

const names = (text: string, pattern: RegExp) => [...text.matchAll(pattern)].map(match => match[1]);

/** Properties scripts read: var(--x), Tailwind's utility-(--x), and '--x' names handed to cssVar(). */
const scriptUses = (text: string) => [
  ...names(text, /var\((--[a-z0-9-]+)/g),
  ...names(text, /-\((--[a-z0-9-]+)\)/g),
  ...names(text, /'(--[a-z0-9-]+)'(?!\s*:)/g),
];

/** Properties scripts set: Tailwind's [--x:value] and React's style={{ '--x': value }}. */
const scriptDefinitions = (text: string) => [
  ...names(text, /\[(--[a-z0-9-]+):/g),
  ...names(text, /'(--[a-z0-9-]+)'\s*:/g),
];

/** Set by Base UI on its popups at runtime. */
const RUNTIME = ['--available-height', '--anchor-width', '--transform-origin'];

/** The custom properties set by every block whose selector list includes this theme. */
function themeBlock(theme: string) {
  const out = new Set<string>();
  for (const match of THEMES.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selectors = match[1].split(',').map(part => part.trim());
    if (!selectors.includes(`[data-theme='${theme}']`)) continue;
    for (const { name } of definitions(match[2])) out.add(name);
  }
  expect(out.size, `no ${theme} theme block`).toBeGreaterThan(0);
  return out;
}

describe('custom properties', () => {
  it('are all defined before they are used', () => {
    const defined = new Set([...definitions(CSS).map(({ name }) => name), ...scriptDefinitions(SCRIPT), ...RUNTIME]);
    const used = new Set([...names(CSS, /var\((--[a-z0-9-]+)/g), ...scriptUses(SCRIPT)]);
    expect([...used].filter(name => !defined.has(name))).toEqual([]);
  });

  /**
   * A token counts as used only if something that is itself used reaches it: a
   * theme mapping one token onto another does not keep either alive.
   */
  it('in tokens.css are all reached from a component, canvas or base style', () => {
    const references = new Map<string, Set<string>>();
    for (const { name, value } of definitions(CSS)) {
      const set = references.get(name) ?? new Set<string>();
      for (const target of names(value, /var\((--[a-z0-9-]+)/g)) set.add(target);
      references.set(name, set);
    }
    // Tailwind's colour utilities read --color-<name> (bg-card, text-muted-foreground, ...).
    const classes = new Set(
      [...SCRIPT.split(/[\s"'`]+/), ...INDEX.split(/[\s;]+/)].map(word =>
        word.replace(/^.*:/, '').replace(/\/\d+$/, ''),
      ),
    );
    const utility =
      /^(?:bg|text|border(?:-[trblxy])?|ring|ring-offset|outline|fill|stroke|from|via|to|divide|placeholder|caret|accent|shadow|decoration)-(.+)$/;
    const colourUtilities = new Set(
      [...classes].map(word => utility.exec(word)?.[1]).filter(name => name !== undefined),
    );
    const theme = /@theme inline\s*\{([^}]*)\}/.exec(INDEX)?.[1] ?? '';
    const roots = [
      ...scriptUses(SCRIPT),
      // var() in rules rather than in token definitions: the base layer and keyframes.
      ...names(INDEX.replace(/(^|[;{])\s*--[a-z0-9-]+\s*:[^;}]*/g, '$1'), /var\((--[a-z0-9-]+)/g),
      ...definitions(theme)
        .map(({ name }) => name)
        .filter(name => !name.startsWith('--color-') || colourUtilities.has(name.slice('--color-'.length))),
    ];
    const live = new Set<string>();
    const visit = (name: string) => {
      if (live.has(name)) return;
      live.add(name);
      for (const next of references.get(name) ?? []) visit(next);
    };
    roots.forEach(visit);
    const unused = definitions(TOKENS)
      .map(({ name }) => name)
      .filter(name => !live.has(name));
    expect(unused).toEqual([]);
  });
});

/** Colours of the felt photograph's own artwork, the same in every theme. */
const FELT_ARTWORK_NAMES = ['--felt-fallback', '--bet-circle'];

describe('the themes', () => {
  const classicColours = definitions(TOKENS)
    .filter(({ value }) => COLOUR.test(value))
    .map(({ name }) => name);

  it('give Classic a literal colour for the ones they theme', () => {
    expect(classicColours.length).toBeGreaterThan(50);
  });

  for (const theme of ['latte', 'mocha']) {
    it(`map every Classic colour in ${theme}`, () => {
      const mapped = themeBlock(theme);
      expect(classicColours.filter(name => !mapped.has(name) && !FELT_ARTWORK_NAMES.includes(name))).toEqual([]);
    });
  }

  it('reach the palette through named roles, not raw hex', () => {
    // Deliberately the same in both flavours, so it takes a literal.
    const SHARED = ['--toggle-knob'];
    const appTokens = new Set(definitions(TOKENS).map(({ name }) => name));
    const rawHex = definitions(THEMES)
      .filter(({ name, value }) => appTokens.has(name) && /^#[0-9a-fA-F]{3,8}$/.test(value))
      .map(({ name }) => name)
      .filter(name => !SHARED.includes(name));
    expect(rawHex).toEqual([]);
  });

  it('keep the felt artwork out of the themes on purpose', () => {
    const renderer = SOURCE['src/game/table/renderer.ts'];
    for (const name of FELT_ARTWORK_NAMES) {
      expect(renderer).toContain(`'${name}'`);
      expect(themeBlock('latte').has(name) || themeBlock('mocha').has(name), name).toBe(false);
    }
  });
});

describe('hard-coded colours', () => {
  /** Every component, and the scripts behind the screens, drills, game and components. */
  const COMPONENTS = SOURCES.filter(
    file => file.endsWith('.tsx') || /^src\/(screens|drills|game|components)\//.test(file),
  );

  /**
   * The strategy files name their cell inks #000 and #fff; tables.tsx turns
   * them into --chart-text / --chart-text-alt through CHART_VARS.
   */
  const KNOWN: Record<string, string[]> = {
    'src/screens/strategy/tables.tsx': ['LEGEND_TEXT_COLORS'],
  };

  it('are only the Classic fallbacks of a named custom property', () => {
    expect(COMPONENTS.length).toBeGreaterThan(50);
    const bare = COMPONENTS.flatMap(file =>
      SOURCE[file]
        .split('\n')
        .map((line, index) => ({ line: line.trim(), number: index + 1 }))
        .filter(({ line }) => COLOUR.test(line))
        // The property name sits on the same line as its fallback.
        .filter(({ line }) => !/'--[a-z0-9-]+'/.test(line))
        .filter(({ line }) => !(KNOWN[file] ?? []).some(name => line.includes(name)))
        .map(({ line, number }) => `${file}:${number}: ${line}`),
    );
    expect(bare).toEqual([]);
  });

  it('are not set in the stylesheets outside a custom property', () => {
    const offenders = CSS.split('\n')
      .map(line => line.trim())
      .filter(line => COLOUR.test(line))
      .filter(line => !/^--[a-z0-9-]+\s*:/.test(line));
    expect(offenders).toEqual([]);
  });
});

describe('type', () => {
  /** The project's weights are 400, 500 and 600; `bold` and 700 are not on it. */
  it('sets weights only from the project scale', () => {
    const offScale = [
      ...names(CSS, /font(?:-weight)?:\s*(bold|bolder|lighter|[1-9]00)\b/g).filter(
        weight => !['400', '500', '600'].includes(weight),
      ),
      ...names(SCRIPT, /\b(font-(?:thin|extralight|light|bold|extrabold|black))\b/g),
    ];
    expect(offScale).toEqual([]);
  });
});
