import { describe, it, expect } from 'vitest';
import { Shoe, SHUFFLE_MODE } from '../../../src/game/engine/shoe.js';
import { CARDS_PER_DECK } from '../../../src/core/cards.js';
import { seededRandom } from '../../../src/core/random.js';

const shoe = (over = {}) => new Shoe({ decks: 2, random: seededRandom(1), ...over });

describe('a freshly shuffled shoe', () => {
  it('holds every card once per deck', () => {
    const s = shoe({ decks: 6 });
    expect(s.totalCards).toBe(6 * CARDS_PER_DECK);
    expect(s.remaining).toBe(6 * CARDS_PER_DECK);
    expect(s.remainingByCard[0]).toBe(0);
    expect(s.remainingByCard.slice(1).every(n => n === 6)).toBe(true);
  });

  it('starts with nothing dealt and no shuffle due', () => {
    const s = shoe();
    expect(s.dealt).toBe(0);
    expect(s.roundsDealt).toBe(0);
    expect(s.cutCardSeen).toBe(false);
    expect(s.needsShuffle).toBe(false);
    expect(s.decksInTray).toBe(0);
  });
});

describe('drawing', () => {
  it('takes one of each card it hands out', () => {
    const s = shoe();
    const card = s.draw();
    expect(s.remainingByCard[card]).toBe(1);
    expect(s.remaining).toBe(2 * CARDS_PER_DECK - 1);
    expect(s.dealt).toBe(1);
  });

  it('deals every card in the shoe and then nothing', () => {
    const s = shoe({ decks: 1 });
    const drawn = [];
    for (let i = 0; i < CARDS_PER_DECK; i++) drawn.push(s.draw());
    expect(drawn.toSorted((a, b) => a - b)).toEqual(Array.from({ length: CARDS_PER_DECK }, (_, i) => i + 1));
    expect(s.draw()).toBe(null);
  });

  it('measures the discard tray in decks', () => {
    const s = shoe({ decks: 6 });
    for (let i = 0; i < CARDS_PER_DECK + 26; i++) s.draw();
    expect(s.decksInTray).toBe(1.5);
  });
});

describe('putting a card back', () => {
  it('undoes a draw exactly', () => {
    const s = shoe();
    const before = { ...s.remainingByCard };
    const card = s.draw();
    s.putBack(card);
    expect({ ...s.remainingByCard }).toEqual(before);
    expect(s.remaining).toBe(2 * CARDS_PER_DECK);
    expect(s.dealt).toBe(0);
  });

  it('puts the card back in play, so it can come out again', () => {
    const s = shoe({ decks: 1 });
    const card = s.draw();
    s.putBack(card);
    const drawn = [];
    for (let i = 0; i < CARDS_PER_DECK; i++) drawn.push(s.draw());
    expect(drawn.filter(c => c === card)).toHaveLength(1);
  });
});

describe('the cut card', () => {
  it('sits the given number of cards from the end', () => {
    expect(shoe({ decks: 6, cardsBehindCutCard: 78 }).penetration).toBe(6 * CARDS_PER_DECK - 78);
  });

  it('shows up on the card after the penetration point, as in the original', () => {
    const s = shoe({ decks: 1, cardsBehindCutCard: CARDS_PER_DECK - 3 });
    for (let i = 0; i < 3; i++) s.draw();
    expect(s.cutCardSeen).toBe(false);
    s.draw();
    expect(s.cutCardSeen).toBe(true);
    expect(s.needsShuffle).toBe(true);
  });

  it('is never reached when the shuffle is counted in rounds', () => {
    const s = shoe({ decks: 1, shuffleMode: SHUFFLE_MODE.rounds });
    expect(s.penetration).toBe(Infinity);
    for (let i = 0; i < CARDS_PER_DECK; i++) s.draw();
    expect(s.cutCardSeen).toBe(false);
  });
});

describe('the end of a round', () => {
  it('counts rounds and shuffles after the agreed number', () => {
    const s = shoe({ decks: 6, shuffleMode: SHUFFLE_MODE.rounds, roundsPerShoe: 3 });
    s.endRound();
    s.endRound();
    expect(s.needsShuffle).toBe(false);
    s.endRound();
    expect(s.roundsDealt).toBe(3);
    expect(s.needsShuffle).toBe(true);
  });

  it('ignores the round count when the cut card decides', () => {
    const s = shoe({ decks: 6, roundsPerShoe: 1 });
    s.endRound();
    expect(s.needsShuffle).toBe(false);
  });

  it('always shuffles once the shoe is empty', () => {
    const s = shoe({ decks: 1, cardsBehindCutCard: 0, shuffleMode: SHUFFLE_MODE.rounds });
    for (let i = 0; i < CARDS_PER_DECK; i++) s.draw();
    s.endRound();
    expect(s.needsShuffle).toBe(true);
  });
});

describe('reshuffling', () => {
  it('puts every card back and clears the shuffle', () => {
    const s = shoe({ decks: 1, cardsBehindCutCard: 10 });
    for (let i = 0; i < 50; i++) s.draw();
    s.endRound();
    s.shuffle();
    expect(s.remaining).toBe(CARDS_PER_DECK);
    expect(s.dealt).toBe(0);
    expect(s.roundsDealt).toBe(0);
    expect(s.cutCardSeen).toBe(false);
    expect(s.needsShuffle).toBe(false);
  });
});
