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
