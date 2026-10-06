// A dropdown must not claim a value it was never given.

import { describe, it, expect } from 'vitest';
import { selectedIndexFor } from '../../public/src/ui/components.js';

describe('a dropdown holding a value that is not one of its options', () => {
  const options = [{ value: 10, label: 'Ten' }, { value: 20, label: 'Twenty' }];

  it('shows the option it was given', () => {
    expect(selectedIndexFor(options, 20)).toBe(1);
  });

  it('shows nothing rather than pretending to be the first option', () => {
    expect(selectedIndexFor(options, 999)).toBe(-1);
  });
});
