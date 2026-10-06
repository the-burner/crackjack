import { describe, it, expect } from 'vitest';
import { Hand } from '../../../public/src/game/engine/hand.js';
import { cardId } from '../../../public/src/core/cards.js';

const SPADES = 0, HEARTS = 2, DIAMONDS = 3;
const card = (rank, suit = SPADES) => cardId(rank, suit);

/** A hand holding the given cards. */
function handOf(cards, over = {}) {
  const hand = new Hand({ seat: 1, ...over });
  cards.forEach(c => hand.addCard(c));
  return hand;
}

describe('a hand', () => {
  it('is empty until a card lands', () => {
    const hand = handOf([]);
    expect(hand.empty).toBe(true);
    hand.addCard(card(5));
    expect(hand.empty).toBe(false);
  });

  it('keeps the hard total beside the soft one', () => {
    const hand = handOf([card(1), card(6)]);
    expect(hand.total).toBe(17);
    expect(hand.hardTotal).toBe(7);
    expect(hand.soft).toBe(true);
  });

  it('reads a 22 as 21 where the table says so', () => {
    const hand = handOf([card(5), card(5), card(12), card(2)], { index: 0 });
    hand.bustCeiling = 22;
    expect(hand.total).toBe(21);
    expect(hand.hardTotal).toBe(21);
    expect(hand.busted()).toBe(false);
  });

  it('adds up everything wagered on it', () => {
    const hand = handOf([card(10), card(10)], { bet: 10 });
    hand.doubleBet = 10;
    hand.insuranceBet = 5;
    hand.sideBets = { main: 3, second: 2 };
    expect(hand.wagered).toBe(30);
  });
});

describe('pairs', () => {
  it('counts a ten and a king as a pair by value but not by rank', () => {
    const hand = handOf([card(10), card(13)]);
    expect(hand.isPair()).toBe(true);
    expect(hand.isPair({ sameRankOnly: true })).toBe(false);
  });

  it('counts two kings as a pair either way', () => {
    const hand = handOf([card(13), card(13, HEARTS)]);
    expect(hand.isPair({ sameRankOnly: true })).toBe(true);
    expect(hand.isAcePair()).toBe(false);
  });
});

describe('bonus shapes', () => {
  it('spots two diamonds', () => {
    expect(handOf([card(1, DIAMONDS), card(13, DIAMONDS)]).isDiamondPair).toBe(true);
    expect(handOf([card(1, DIAMONDS), card(13, HEARTS)]).isDiamondPair).toBe(false);
  });

  it('spots a suited ace-jack either way round', () => {
    expect(handOf([card(1), card(11)]).isSuitedAceJack).toBe(true);
    expect(handOf([card(11), card(1)]).isSuitedAceJack).toBe(true);
  });

  it('wants the ace and the jack in the same suit, and only two cards', () => {
    expect(handOf([card(1), card(11, HEARTS)]).isSuitedAceJack).toBe(false);
    expect(handOf([card(1), card(12)]).isSuitedAceJack).toBe(false);
    expect(handOf([card(1), card(11), card(2)]).isSuitedAceJack).toBe(false);
    expect(handOf([card(1)]).isSuitedAceJack).toBe(false);
  });

  it('spots an ace and jack of hearts', () => {
    expect(handOf([card(1, HEARTS), card(11, HEARTS)]).isHeartsAceJack).toBe(true);
    expect(handOf([card(11, HEARTS), card(1, HEARTS)]).isHeartsAceJack).toBe(true);
  });

  it('wants both cards in hearts, and only two of them', () => {
    expect(handOf([card(1), card(11, HEARTS)]).isHeartsAceJack).toBe(false);
    expect(handOf([card(1, HEARTS), card(12, HEARTS)]).isHeartsAceJack).toBe(false);
    expect(handOf([card(1, HEARTS), card(11, HEARTS), card(2)]).isHeartsAceJack).toBe(false);
  });
});
