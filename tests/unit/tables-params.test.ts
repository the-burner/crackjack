// The table viewer's address always names the module whose tables it shows.

import { describe, it, expect } from 'vitest';
import { tablesParams, tablesSearch } from '@/app/paths';

const read = (search: string) => tablesParams(new URLSearchParams(search));

describe('tables address', () => {
  it('carries the module there and back', () => {
    expect(read(tablesSearch({ scope: 'flash', decks: 2 }))).toMatchObject({ scope: 'flash', decks: 2 });
  });

  it('shows the Charts, no module, for an address naming none or an unknown one', () => {
    expect(read('').scope).toBe('charts');
    expect(read('?scope=nonsense').scope).toBe('charts');
  });
});
