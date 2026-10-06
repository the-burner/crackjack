import { describe, it, expect } from 'vitest';
import { HELP } from '../../public/src/data/help.js';

/** Tags that are closed without being open, or left open, in one help page. */
function tagProblems(html) {
  const stack = [];
  const problems = [];
  for (const [, close, tag, self] of html.matchAll(/<(\/?)([a-zA-Z0-9]+)[^>]*?(\/?)>/g)) {
    const name = tag.toLowerCase();
    if (self || ['br', 'img', 'hr'].includes(name)) continue;
    if (!close) stack.push(name);
    else if (stack.at(-1) === name) stack.pop();
    else problems.push(`</${name}>`);
  }
  return [...problems, ...stack.map(name => `<${name}> left open`)];
}

describe('help text', () => {
  it('has no broken characters', () => {
    const broken = Object.entries(HELP).filter(([, html]) => html.includes('\uFFFD')).map(([key]) => key);
    expect(broken).toEqual([]);
  });

  it('has balanced HTML tags', () => {
    const problems = Object.entries(HELP).map(([key, html]) => [key, tagProblems(html)]).filter(([, list]) => list.length);
    expect(problems).toEqual([]);
  });
});

describe('each screen gets its own help', () => {
  it('does not describe one screen with another screen’s page', () => {
    const duplicates = new Map();
    for (const [key, html] of Object.entries(HELP)) {
      const seen = duplicates.get(html);
      if (seen) throw new Error(`${key} and ${seen} share the same help page`);
      duplicates.set(html, key);
    }
  });

  it('tells the bet picker apart from the betting settings', () => {
    expect(HELP['game.betSelect']).toBeDefined();
    expect(HELP['game.betSelect']).not.toBe(HELP['settings.betting']);
    // The picker is where a bet is chosen, not where the ramp is configured.
    expect(HELP['game.betSelect']).not.toContain('Warning on Betting Error');
  });
});

describe('the unusual games help', () => {
  const html = HELP['settings.unusualGames'];
  const named = [...html.matchAll(/<li>\s*<strong>\s*([^<]+?)\s*<\/strong>/g)].map(m => m[1].replace(/\s+/g, ' ').trim());

  it('names each game once', () => {
    const twice = named.filter((name, i) => named.indexOf(name) !== i);
    expect(twice).toEqual([]);
  });

  it('describes only games the app offers', async () => {
    const { BUILTIN_SIDE_BET_GAMES } = await import('../../public/src/data/side-bet-games.js');
    // The help abbreviates "blackjack" to "BJ", so normalise both.
    const key = name => name.toLowerCase().replace(/blackjack/g, 'bj').replace(/[^a-z0-9+]/g, '');
    const offered = BUILTIN_SIDE_BET_GAMES.map(game => key(game.name));
    const missing = named.filter(name => !offered.some(game => game.includes(key(name)) || key(name).includes(game)));
    expect(missing).toEqual([]);
  });
});
