// What the stylesheets' colours actually look like once a theme has resolved
// them: every var() chain is followed to a literal, then measured.
//
// The eye is the only other check on this. A theme can map a role to a colour
// that is perfectly pleasant on its own and unreadable where it is used, and
// nothing in the suite notices.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const DIR = 'public/src/ui/styles/';
/** The order index.html loads them in: equal specificity is settled by it. */
const FILES = ['app.css', 'icons.css', 'screens.css', 'settings.css',
  'strategy.css', 'drills.css', 'game.css', 'themes.css'];
const SOURCE = FILES.map(name => readFileSync(DIR + name, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''));

const THEMES = ['classic', 'latte', 'mocha'];

/** Every top-level `selector { body }` pair, in source order. */
function blocks(text) {
  const out = [];
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
    out.push([text.slice(i, open).trim(), text.slice(open + 1, j - 1)]);
    i = j;
  }
  return out;
}

/** Does a block's selector list style the html element under this theme? */
function styles(selector, theme) {
  return selector.split(',').map(part => part.trim())
    .some(part => part === ':root' || (theme !== 'classic' && part === `[data-theme='${theme}']`));
}

/** Every custom property a theme ends up with, last declaration winning. */
function properties(theme) {
  const map = new Map();
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

/** The body of a rule, for the declarations a check needs to read. */
function rule(wanted) {
  for (const text of SOURCE) {
    for (const [selector, body] of blocks(text)) if (selector === wanted) return body;
  }
  throw new Error(`no rule ${wanted}`);
}

/* --- Colour ---------------------------------------------------------------- */

const HEX = /^#([0-9a-f]{3,8})$/i;

function parse(value) {
  const hex = HEX.exec(value);
  if (hex) {
    const digits = hex[1].length <= 4
      ? [...hex[1]].map(digit => digit + digit).join('')
      : hex[1];
    const bytes = digits.match(/../g).map(pair => parseInt(pair, 16));
    return { r: bytes[0], g: bytes[1], b: bytes[2], a: bytes[3] === undefined ? 1 : bytes[3] / 255 };
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(value);
  if (rgb) {
    const parts = rgb[1].split(/[,/\s]+/).filter(Boolean).map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] === undefined ? 1 : parts[3] };
  }
  throw new Error(`cannot read the colour ${value}`);
}

/** Splits a function's arguments on the commas that are not inside brackets. */
function args(text) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') depth -= 1;
    else if (text[i] === ',' && depth === 0) { out.push(text.slice(start, i)); start = i + 1; }
  }
  out.push(text.slice(start));
  return out.map(part => part.trim());
}

/** Follows var() chains and color-mix() down to literal channels. */
function colour(value, theme, seen = new Set()) {
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
    const blend = (x, y) => x * weight + y * (1 - weight);
    return { r: blend(a.r, b.r), g: blend(a.g, b.g), b: blend(a.b, b.b), a: blend(a.a, b.a) };
  }
  return parse(text);
}

const value = (name, theme) => colour(`var(${name})`, theme);

/** A translucent colour laid over an opaque one. */
function over(front, back) {
  if (front.a === 1) return front;
  const mix = (x, y) => x * front.a + y * (1 - front.a);
  return { r: mix(front.r, back.r), g: mix(front.g, back.g), b: mix(front.b, back.b), a: 1 };
}

const channel = byte => {
  const unit = byte / 255;
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
};

const luminance = ({ r, g, b }) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

function contrast(front, back) {
  const a = luminance(over(front, back));
  const b = luminance(back);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** CIE76, for "is this plainly a different colour" rather than readability. */
function lab({ r, g, b }) {
  const [x, y, z] = [
    0.4124 * channel(r) + 0.3576 * channel(g) + 0.1805 * channel(b),
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b),
    0.0193 * channel(r) + 0.1192 * channel(g) + 0.9505 * channel(b),
  ];
  const f = (part, white) => {
    const ratio = part / white;
    return ratio > 0.008856 ? Math.cbrt(ratio) : 7.787 * ratio + 16 / 116;
  };
  const [fx, fy, fz] = [f(x, 0.9505), f(y, 1), f(z, 1.089)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const difference = (one, two) => Math.hypot(...lab(one).map((part, i) => part - lab(two)[i]));

const show = number => number.toFixed(2);

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
function below(floor, pairs) {
  return pairs
    .map(([label, front, back]) => [label, contrast(front, back)])
    .filter(([, ratio]) => ratio < floor)
    .map(([label, ratio]) => `${label}: ${show(ratio)}`);
}

describe('text over the felt', () => {
  it('writes the drills\' and the game\'s felt accent legibly on both felts', () => {
    // Display text (.drill__count at 600 20px, .bet-overlay__title at bold
    // 17px), held to the large-text floor: Latte has no accent that reaches
    // 4.5 on its own light felt, its darkest managing about 4.2.
    const pairs = THEMES.flatMap(theme => {
      const accent = value('--felt-accent', theme);
      const panel = over(value('--bet-overlay-bg', theme), value('--table-bg', theme));
      return [
        [`${theme} --felt-accent on --felt`, accent, value('--felt', theme)],
        [`${theme} --felt-accent on --bet-overlay-bg`, accent, panel],
      ];
    });
    expect(below(LARGE, pairs)).toEqual([]);
  });

  it('writes the felt text legibly on both of the Full Table drill\'s felts', () => {
    // .drill__message is 600 16px on --felt; the drill's canvas notice is
    // bold 32px, and that is the only text over --felt-alt.
    const onFelt = THEMES.map(theme =>
      [`${theme} --felt-text on --felt`, value('--felt-text', theme), value('--felt', theme)]);
    const onAlt = THEMES.map(theme =>
      [`${theme} --felt-text on --felt-alt`, value('--felt-text', theme), value('--felt-alt', theme)]);
    expect([...below(AA, onFelt), ...below(LARGE, onAlt)]).toEqual([]);
  });

  it('keeps the bar over the felt light, in every theme', () => {
    // In landscape the game's bar is transparent over the felt photograph,
    // which is dark in every theme by design: --felt-fallback stands in for it.
    // The photograph has lighter passages than its fallback, so the ink has to
    // be a light one and not merely clear the fallback.
    const pairs = THEMES.map(theme =>
      [`${theme} --bar-text on --felt-fallback`,
        value('--bar-text', theme), value('--felt-fallback', theme)]);
    const dark = THEMES
      .map(theme => [theme, luminance(value('--bar-text', theme))])
      .filter(([, light]) => light < 0.5)
      .map(([theme, light]) => `${theme} --bar-text luminance: ${show(light)}`);
    expect([...below(AA, pairs), ...dark]).toEqual([]);
  });

  it('keeps the two Full Table felts plainly different colours', () => {
    // The second table's colour is the only cue for which table is being counted.
    const same = THEMES
      .map(theme => [theme, difference(value('--felt', theme), value('--felt-alt', theme))])
      .filter(([, gap]) => gap < 25)
      .map(([theme, gap]) => `${theme} --felt to --felt-alt: ${show(gap)}`);
    expect(same).toEqual([]);
  });
});

describe('text on a coloured tile', () => {
  it('reads on every graded answer tile and bet tile', () => {
    const pairs = THEMES.flatMap(theme => {
      const mark = value('--tile-mark-text', theme);
      return [
        ...['--tile-good', '--tile-close', '--tile-bad', '--tile-previous'].map(name =>
          [`${theme} --tile-mark-text on ${name}`, mark, value(name, theme)]),
        [`${theme} --tile-text on --tile-bg`, value('--tile-text', theme), value('--tile-bg', theme)],
        [`${theme} --toast-error-text on --tile-bad`,
          value('--toast-error-text', theme), value('--tile-bad', theme)],
      ];
    });
    expect(below(CHIP, pairs)).toEqual([]);
  });

  it('reads on every pop-up and every result on a seat, which share their tones', () => {
    const pairs = THEMES.flatMap(theme => [
      [`${theme} plain: --page-bg on --text`, value('--page-bg', theme), value('--text', theme)],
      [`${theme} good: --tile-mark-text on --tile-good`, value('--tile-mark-text', theme), value('--tile-good', theme)],
      [`${theme} error: --toast-error-text on --tile-bad`, value('--toast-error-text', theme), value('--tile-bad', theme)],
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
    const collapsed = [];
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
  it('marks the right answer legibly on a button', () => {
    const pairs = THEMES.map(theme =>
      [`${theme} --answer-correct on --btn-bg`,
        value('--answer-correct', theme), value('--btn-bg', theme)]);
    expect(below(AA, pairs)).toEqual([]);
  });

  it('writes an overdue time legibly in the stats panel', () => {
    const pairs = THEMES.map(theme =>
      [`${theme} --warning on --panel-bg`, value('--warning', theme), value('--panel-bg', theme)]);
    expect(below(AA, pairs)).toEqual([]);
  });

  /**
   * `.btn:disabled` only fades the button, so a primary one over a felt of the
   * same colour composites back to exactly the enabled colour.
   */
  it('cannot show a disabled button as an enabled primary one', () => {
    const declarations = rule('.btn:disabled');
    const opacity = Number(/opacity:\s*([\d.]+)/.exec(declarations)[1]);
    const background = /(?:^|;)\s*background(?:-color)?:\s*([^;]+)/.exec(declarations)?.[1]
      ?? 'var(--primary-bg)';
    const same = [];
    for (const theme of THEMES) {
      const felt = value('--felt', theme);
      const faded = { ...colour(background, theme), a: opacity };
      const ratio = contrast(over(faded, felt), value('--primary-bg', theme));
      if (ratio < 1.5) same.push(`${theme} disabled over --felt against --primary-bg: ${show(ratio)}`);
    }
    expect(same).toEqual([]);
  });
});

describe('the controls', () => {
  it('shows the knob of a switch that is on', () => {
    // A control's own parts need 3:1, not 4.5.
    const pairs = THEMES.map(theme =>
      [`${theme} --toggle-knob on --check-on`,
        value('--toggle-knob', theme), value('--check-on', theme)]);
    expect(below(LARGE, pairs)).toEqual([]);
  });

  /**
   * Classic's hairline ring on a white field inside a white card is the
   * original look, and Classic is the fidelity reference; the two themes have
   * no such excuse, and a number field that reads as plain text is not a field.
   */
  it('outlines a number field inside a group card, in both themes', () => {
    const pairs = ['latte', 'mocha'].flatMap(theme => [
      [`${theme} --input-border on --group-bg`,
        value('--input-border', theme), value('--group-bg', theme)],
      [`${theme} --input-border on --input-bg`,
        value('--input-border', theme), value('--input-bg', theme)],
    ]);
    expect(below(2.5, pairs)).toEqual([]);
  });

  /**
   * Where the page is light the scrim has to darken it enough for a dialog to
   * lift off it. A dark theme's page is already dark, and separates by shadow.
   */
  it('dims a light page enough for a dialog to sit on it', () => {
    const faint = [];
    for (const theme of THEMES) {
      const page = value('--page-bg', theme);
      if (luminance(page) < 0.5) continue;
      const dimmed = over(value('--overlay', theme), page);
      const ratio = contrast(value('--dialog-bg', theme), dimmed);
      if (ratio < 2.5) faint.push(`${theme} --dialog-bg against the dimmed page: ${show(ratio)}`);
    }
    expect(faint).toEqual([]);
  });
});

describe('the wordmark', () => {
  it('writes both of its words on the page in large-text contrast', () => {
    const pairs = THEMES.flatMap(theme => ['--logo-crack', '--logo-jack'].map(name =>
      [`${theme} ${name} on --page-bg`, value(name, theme), value('--page-bg', theme)]));
    expect(below(LARGE, pairs)).toEqual([]);
  });

  it('keeps its two words plainly different colours', () => {
    const same = THEMES
      .map(theme => [theme, difference(value('--logo-crack', theme), value('--logo-jack', theme))])
      .filter(([, gap]) => gap < 20)
      .map(([theme, gap]) => `${theme} --logo-crack to --logo-jack: ${show(gap)}`);
    expect(same).toEqual([]);
  });
});
