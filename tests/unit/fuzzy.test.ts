import { describe, it, expect } from 'vitest';
import { fuzzyFilter, fuzzyScore } from '@/lib/fuzzy';

const NAMES = [
  "Crackjack's 6D,H17,LS,DAS",
  'Emerald Queen Double Deck Tacoma, WA 2D H17 DAS LS',
  'Emerald Queen 8-Deck Shoe Tacoma, WA 8D H17 DAS LS RSA',
  'Emerald Queen Spanish 21 Tacoma, WA Spanish 21 6D H17',
  'Bellagio 6D,S17,LS,DAS',
];
const find = (query: string) => fuzzyFilter(NAMES, query, name => name);

describe('fuzzy matching', () => {
  it('finds a name with letters skipped, ignoring case and punctuation', () => {
    expect(find('bel6d')).toEqual(['Bellagio 6D,S17,LS,DAS']);
    expect(find('EMERALD spanish')[0]).toBe('Emerald Queen Spanish 21 Tacoma, WA Spanish 21 6D H17');
    expect(fuzzyScore('xyz', 'Bellagio')).toBeNull();
  });

  it('needs every word typed, in any order, and puts whole words first', () => {
    expect(find('rsa tacoma')[0]).toBe('Emerald Queen 8-Deck Shoe Tacoma, WA 8D H17 DAS LS RSA');
    expect(find('tacoma 2d')[0]).toBe('Emerald Queen Double Deck Tacoma, WA 2D H17 DAS LS');
    expect(find('qqq')).toEqual([]);
  });

  it('keeps everything, in order, for an empty query', () => {
    expect(find('')).toEqual(NAMES);
    expect(find('  ,  ')).toEqual(NAMES);
  });
});
