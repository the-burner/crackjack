// What the colour tokens actually look like once a theme has resolved them:
// every var() chain is followed to a literal, then measured.
//
// The eye is the only other check on this. A theme can map a role to a colour
// that is perfectly pleasant on its own and unreadable where it is used, and
// nothing in the suite notices.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** The cascade order: tokens, then the themes over them, then shadcn's tokens mapped onto both. */
const FILES = ['src/styles/tokens.css', 'src/styles/themes.css', 'src/index.css'];
const SOURCE = FILES.map(file => readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''));

const THEMES = ['classic', 'latte', 'mocha'];

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}
/** A label with the ink and the ground it is measured on. */
type Pair = [label: string, front: Rgba, back: Rgba];

/** Every top-level `selector { body }` pair, in source order. */
function blocks(text: string) {
  const out: [selector: string, body: string][] = [];
  for (let i = 0; i < text.length;) {
    const open = text.indexOf('{', i);
    if (open === -1) break;
    let depth = 1;
    let j = open + 1;
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth += 1;
      else if (text[j] === '}') depth -= 1;
      j += 1;
    }
    // Statements such as @import end in a semicolon; the selector follows the last one.
    out.push([(text.slice(i, open).split(';').at(-1) ?? '').trim(), text.slice(open + 1, j - 1)]);
    i = j;
  }
  return out;
}

/** Does a block's selector list style the html element under this theme? */
function styles(selector: string, theme: string) {
  return selector
    .split(',')
    .map(part => part.trim())
    .some(part => part === ':root' || (theme !== 'classic' && part === `[data-theme='${theme}']`));
}

/** Every custom property a theme ends up with, last declaration winning. */
function properties(theme: string) {
  const map = new Map<string, string>();
  for (const text of SOURCE) {
    for (const [selector, body] of blocks(text)) {
      if (!styles(selector, theme)) continue;
      for (const part of body.split(';')) {
        const match = /^\s*(--[a-z0-9-]+)\s*:\s*(.+)$/s.exec(part);
        if (match) map.set(match[1], match[2].trim());
      }
    }
  }
  return map;
}

const THEME = Object.fromEntries(THEMES.map(name => [name, properties(name)]));

/* --- Colour ---------------------------------------------------------------- */

const HEX = /^#([0-9a-f]{3,8})$/i;

function parse(value: string): Rgba {
  const hex = HEX.exec(value);
  if (hex) {
    const digits = hex[1].length <= 4 ? [...hex[1]].map(digit => digit + digit).join('') : hex[1];
    const bytes = digits.match(/../g)!.map(pair => parseInt(pair, 16));
    return { r: bytes[0], g: bytes[1], b: bytes[2], a: bytes[3] === undefined ? 1 : bytes[3] / 255 };
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(value);
  if (rgb) {
    const parts = rgb[1]
      .split(/[,/\s]+/)
      .filter(Boolean)
      .map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] === undefined ? 1 : parts[3] };
  }
  throw new Error(`cannot read the colour ${value}`);
}

/** Splits a function's arguments on the commas that are not inside brackets. */
function args(text: string) {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') depth -= 1;
    else if (text[i] === ',' && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out.map(part => part.trim());
}

/** Follows var() chains and color-mix() down to literal channels. */
function colour(value: string, theme: string, seen = new Set<string>()): Rgba {
  const text = value.trim();
  const variable = /^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([\s\S]+))?\)$/.exec(text);
  if (variable) {
    const [, name, fallback] = variable;
    if (seen.has(name)) throw new Error(`${name} refers to itself`);
    const next = THEME[theme].get(name);
    if (next === undefined && fallback === undefined) throw new Error(`${name} is not defined`);
    return colour(next ?? fallback, theme, new Set([...seen, name]));
  }
  const mix = /^color-mix\(([\s\S]+)\)$/.exec(text);
  if (mix) {
    const [space, first, second] = args(mix[1]);
    expect(space, 'only srgb mixes are measured here').toBe('in srgb');
    const share = /^([\s\S]+?)\s+([\d.]+)%$/.exec(first);
    const weight = share ? Number(share[2]) / 100 : 0.5;
    const a = colour(share ? share[1] : first, theme);
    const b = colour(second, theme);
    const blend = (x: number, y: number) => x * weight + y * (1 - weight);
    return { r: blend(a.r, b.r), g: blend(a.g, b.g), b: blend(a.b, b.b), a: blend(a.a, b.a) };
  }
  return parse(text);
}

const value = (name: string, theme: string) => colour(`var(${name})`, theme);

/** A translucent colour laid over an opaque one. */
function over(front: Rgba, back: Rgba): Rgba {
  if (front.a === 1) return front;
  const mix = (x: number, y: number) => x * front.a + y * (1 - front.a);
  return { r: mix(front.r, back.r), g: mix(front.g, back.g), b: mix(front.b, back.b), a: 1 };
}

const channel = (byte: number) => {
  const unit = byte / 255;
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
};

const luminance = ({ r, g, b }: Rgba) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

function contrast(front: Rgba, back: Rgba) {
  const a = luminance(over(front, back));
  const b = luminance(back);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** CIE76, for "is this plainly a different colour" rather than readability. */
function lab({ r, g, b }: Rgba) {
  const [x, y, z] = [
    0.4124 * channel(r) + 0.3576 * channel(g) + 0.1805 * channel(b),
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b),
    0.0193 * channel(r) + 0.1192 * channel(g) + 0.9505 * channel(b),
  ];
  const f = (part: number, white: number) => {
    const ratio = part / white;
    return ratio > 0.008856 ? Math.cbrt(ratio) : 7.787 * ratio + 16 / 116;
  };
  const [fx, fy, fz] = [f(x, 0.9505), f(y, 1), f(z, 1.089)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const difference = (one: Rgba, two: Rgba) => Math.hypot(...lab(one).map((part, i) => part - lab(two)[i]));

const show = (number: number) => number.toFixed(2);

/**
 * WCAG AA: 4.5 for text, 3 for large text (>= 18.66px bold or 24px) and for the
 * boundaries of a control. Each check says which it holds a pair to and why.
 */
const AA = 4.5;
const LARGE = 3;
/**
 * Ink on one of the saturated chips and tiles. Classic writes #fff on #ff0000
 * there, just short of 4, and Classic is the fidelity reference: that pair is
 * itself the floor, and the themes have to match it.
 */
const CHIP = contrast(parse('#fff'), parse('#ff0000'));

/** Collects "theme: measurement" lines so a failure says what it measured. */
function below(floor: number, pairs: Pair[]) {
  return pairs
    .map(([label, front, back]) => [label, contrast(front, back)] as const)
    .filter(([, ratio]) => ratio < floor)
    .map(([label, ratio]) => `${label}: ${show(ratio)}`);
}

describe('text over the felt', () => {
  it("writes the drills' and the game's felt accent legibly on both felts", () => {
    // Display text (.drill__count at 600 20px, .bet-overlay__title at bold
    // 17px), held to the large-text floor: Latte has no accent that reaches
    // 4.5 on its own light felt, its darkest managing about 4.2.
    const pairs = THEMES.flatMap((theme): Pair[] => {
      const accent = value('--felt-accent', theme);
      const panel = over(value('--bet-overlay-bg', theme), value('--table-bg', theme));
      return [
        [`${theme} --felt-accent on --felt`, accent, value('--felt', theme)],
        [`${theme} --felt-accent on --bet-overlay-bg`, accent, panel],
      ];
    });
    expect(below(LARGE, pairs)).toEqual([]);
  });

  it("writes the felt text legibly on both of the Full Table drill's felts", () => {
    // .drill__message is 600 16px on --felt; the drill's canvas notice is
    // bold 32px, and that is the only text over --felt-alt.
    const onFelt = THEMES.map((theme): Pair => [
      `${theme} --felt-text on --felt`,
      value('--felt-text', theme),
      value('--felt', theme),
    ]);
    const onAlt = THEMES.map((theme): Pair => [
      `${theme} --felt-text on --felt-alt`,
      value('--felt-text', theme),
      value('--felt-alt', theme),
    ]);
    expect([...below(AA, onFelt), ...below(LARGE, onAlt)]).toEqual([]);
  });

  it('keeps the bar over the felt light, in every theme', () => {
    // In landscape the game's bar is transparent over the felt photograph,
    // which is dark in every theme by design: --felt-fallback stands in for it.
    // The photograph has lighter passages than its fallback, so the ink has to
    // be a light one and not merely clear the fallback.
    const pairs = THEMES.map((theme): Pair => [
      `${theme} --bar-text on --felt-fallback`,
      value('--bar-text', theme),
      value('--felt-fallback', theme),
    ]);
    const dark = THEMES.map(theme => [theme, luminance(value('--bar-text', theme))] as const)
      .filter(([, light]) => light < 0.5)
      .map(([theme, light]) => `${theme} --bar-text luminance: ${show(light)}`);
    expect([...below(AA, pairs), ...dark]).toEqual([]);
  });

  it('keeps the two Full Table felts plainly different colours', () => {
    // The second table's colour is the only cue for which table is being counted.
    const same = THEMES.map(theme => [theme, difference(value('--felt', theme), value('--felt-alt', theme))] as const)
      .filter(([, gap]) => gap < 25)
      .map(([theme, gap]) => `${theme} --felt to --felt-alt: ${show(gap)}`);
    expect(same).toEqual([]);
  });
});

describe('text on a coloured tile', () => {
  it('reads on every graded answer tile and bet tile', () => {
    const pairs = THEMES.flatMap((theme): Pair[] => {
      const mark = value('--tile-mark-text', theme);
      return [
        ...['--tile-good', '--tile-close', '--tile-bad', '--tile-previous'].map((name): Pair => [
          `${theme} --tile-mark-text on ${name}`,
          mark,
          value(name, theme),
        ]),
        [`${theme} --tile-text on --tile-bg`, value('--tile-text', theme), value('--tile-bg', theme)],
      ];
    });
    expect(below(CHIP, pairs)).toEqual([]);
  });

  it('reads on every pop-up and every result on a seat, which share their tones', () => {
    const pairs = THEMES.flatMap((theme): Pair[] => [
      [`${theme} plain: --page-bg on --text`, value('--page-bg', theme), value('--text', theme)],
      [`${theme} good: --tile-mark-text on --tile-good`, value('--tile-mark-text', theme), value('--tile-good', theme)],
      [`${theme} error: --tile-mark-text on --tile-bad`, value('--tile-mark-text', theme), value('--tile-bad', theme)],
    ]);
    expect(below(CHIP, pairs)).toEqual([]);
  });

  /**
   * Classic defines these pairs the opposite way round on purpose, so code can
   * pick whichever member stays legible on the cell it is filling: the strategy
   * files say #000 or #fff per cell and tables.js translates that into the pair.
   * A theme that maps both members to one colour makes the choice a no-op.
   */
  it('keeps both members of an opposite pair, in every theme', () => {
    // --chart-text / --chart-text-alt is the third such pair, and CSS alone
    // cannot keep it: strategy-grid.js puts the dark member on the error
    // counts and the light one on the legend box, both over --chart-opposite,
    // and neither palette has a red that can carry both inks.
    const PAIRS = [['--grid-mark', '--grid-mark-alt']];
    const collapsed: string[] = [];
    for (const theme of THEMES) {
      for (const [one, two] of PAIRS) {
        const [a, b] = [value(one, theme), value(two, theme)];
        if (difference(a, b) < 1) collapsed.push(`${theme} ${one} = ${two}`);
      }
    }
    expect(collapsed).toEqual([]);
  });
});

describe('the drill screens', () => {
  it('marks the right answer legibly on a secondary button', () => {
    const pairs = THEMES.map((theme): Pair => [
      `${theme} --answer-correct on --btn-bg`,
      value('--answer-correct', theme),
      value('--btn-bg', theme),
    ]);
    expect(below(AA, pairs)).toEqual([]);
  });
});

describe('the wordmark', () => {
  it('writes both of its words on the page in large-text contrast', () => {
    const pairs = THEMES.flatMap((theme): Pair[] =>
      ['--logo-crack', '--logo-jack'].map(name => [
        `${theme} ${name} on --page-bg`,
        value(name, theme),
        value('--page-bg', theme),
      ]),
    );
    expect(below(LARGE, pairs)).toEqual([]);
  });

  it('keeps its two words plainly different colours', () => {
    const same = THEMES.map(
      theme => [theme, difference(value('--logo-crack', theme), value('--logo-jack', theme))] as const,
    )
      .filter(([, gap]) => gap < 20)
      .map(([theme, gap]) => `${theme} --logo-crack to --logo-jack: ${show(gap)}`);
    expect(same).toEqual([]);
  });
});
