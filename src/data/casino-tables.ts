// Casino games bundled as built-in tables, as Current Blackjack News (BJ21.com) lists them. Each is copied
// from the guide's columns: decks, cut (decks unseen at the shuffle), minimum, maximum and rules codes.

import type { CbjnGame } from '@/settings/cbjn';

export interface CasinoTable extends CbjnGame {
  id: string;
  /** The casino and the game ("Emerald Queen Double Deck"). */
  name: string;
  /** Where it is ("Tacoma, WA"). */
  place: string;
  /** The issue it was copied from. */
  source: string;
}

export const CASINO_TABLES: readonly CasinoTable[] = [
  // Emerald Queen (I), Tacoma, WA: CBJN Oct 2026, p. 21 (reported Jun 2026).
  {
    id: 'emerald-queen-2d',
    name: 'Emerald Queen Double Deck',
    place: 'Tacoma, WA',
    source: 'CBJN Oct 2026',
    decks: 2,
    cut: 0.8,
    min: 25,
    max: 500,
    rules: 'h17,ds,ls,nms,sc,pv',
  },
  {
    id: 'emerald-queen-8d',
    name: 'Emerald Queen 8-Deck Shoe',
    place: 'Tacoma, WA',
    source: 'CBJN Oct 2026',
    decks: 8,
    cut: 1.1,
    min: 15,
    max: 500,
    rules: 'h17,ds,ls,rsa,pv',
  },
  {
    id: 'emerald-queen-spanish-21',
    name: 'Emerald Queen Spanish 21',
    place: 'Tacoma, WA',
    source: 'CBJN Oct 2026',
    decks: 6,
    cut: 1.7,
    min: 15,
    max: 500,
    rules: 'Spanish,h17,pv',
  },
];
