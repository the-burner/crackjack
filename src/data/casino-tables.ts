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
  // Seattle area (Kirkland, Renton, Auburn, Tukwila, Snoqualmie), WA: CBJN Oct 2026, pp. 20–21 (reported Jul 2026).
  {
    id: 'caribbean-kirkland-6d',
    name: 'Caribbean Kirkland 6-Deck Shoe',
    place: 'Kirkland, WA (Seattle area)',
    source: 'CBJN Oct 2026',
    decks: 6,
    cut: 1.6,
    min: 10,
    max: 400,
    rules: 'h17,ds,ls,rsa,pv',
  },
  {
    id: 'fortune-renton-6d',
    name: 'Fortune Renton 6-Deck Shoe',
    place: 'Renton, WA (Seattle area)',
    source: 'CBJN Oct 2026',
    decks: 6,
    cut: 1.0,
    min: 10,
    max: 400,
    rules: 'h17,ds,ls,pv',
  },
  {
    id: 'imperial-auburn-2d',
    name: 'Imperial Palace Auburn Double Deck',
    place: 'Auburn, WA (Seattle area)',
    source: 'CBJN Oct 2026',
    decks: 2,
    cut: 0.9,
    min: 25,
    max: 400,
    rules: 'h17,d9,shoe',
  },
  {
    id: 'imperial-auburn-6d',
    name: 'Imperial Palace Auburn 6-Deck Shoe',
    place: 'Auburn, WA (Seattle area)',
    source: 'CBJN Oct 2026',
    decks: 6,
    cut: 1.5,
    min: 5,
    max: 400,
    rules: 'h17,ds,rsa,pv',
  },
  {
    id: 'imperial-tukwila-2d',
    name: 'Imperial Palace Tukwila Double Deck',
    place: 'Tukwila, WA (Seattle area)',
    source: 'CBJN Oct 2026',
    decks: 2,
    cut: 1.0,
    min: 25,
    max: 400,
    rules: 'h17,d9,nm,pv',
  },
  {
    id: 'muckleshoot-2d',
    name: 'Muckleshoot Double Deck',
    place: 'Auburn, WA (Seattle area)',
    source: 'CBJN Oct 2026',
    decks: 2,
    cut: 1.0,
    min: 25,
    max: 2500,
    rules: 'h17,ds,nm,pv',
  },
  {
    id: 'muckleshoot-8d',
    name: 'Muckleshoot 8-Deck Shoe',
    place: 'Auburn, WA (Seattle area)',
    source: 'CBJN Oct 2026',
    decks: 8,
    cut: 1.0,
    min: 10,
    max: 500,
    rules: 'h17,ds,pv',
  },
  {
    id: 'muckleshoot-spanish-21',
    name: 'Muckleshoot Spanish 21',
    place: 'Auburn, WA (Seattle area)',
    source: 'CBJN Oct 2026',
    decks: 8,
    cut: 1.0,
    min: 10,
    max: 500,
    rules: 'Spanish,h17,pv',
  },
  {
    id: 'snoqualmie-8d',
    name: 'Snoqualmie 8-Deck Shoe',
    place: 'Snoqualmie, WA (Seattle area)',
    source: 'CBJN Oct 2026',
    decks: 8,
    cut: 0.7,
    min: 10,
    max: 500,
    rules: 'h17,ds,rsa',
  },
  {
    id: 'snoqualmie-spanish-21',
    name: 'Snoqualmie Spanish 21',
    place: 'Snoqualmie, WA (Seattle area)',
    source: 'CBJN Oct 2026',
    decks: 8,
    cut: 0.7,
    min: 10,
    max: 500,
    rules: 'Spanish,h17',
  },
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
