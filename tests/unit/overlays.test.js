import { describe, it, expect } from 'vitest';
import { dismissTopOverlay, registerOverlay } from '../../public/src/ui/overlays.js';

describe('overlay registry', () => {
  it('dismisses the newest overlay first', () => {
    const closed = [];
    const first = registerOverlay(() => closed.push('first'));
    const second = registerOverlay(() => closed.push('second'));

    expect(dismissTopOverlay()).toBe(true);
    expect(closed).toEqual(['second']);
    second();

    expect(dismissTopOverlay()).toBe(true);
    expect(closed).toEqual(['second', 'first']);
    first();
  });

  it('reports when nothing is open', () => {
    expect(dismissTopOverlay()).toBe(false);
  });

  it('forgets an overlay that closed on its own', () => {
    const closed = [];
    const unregister = registerOverlay(() => closed.push('x'));
    unregister();
    expect(dismissTopOverlay()).toBe(false);
    expect(closed).toEqual([]);
  });
});
