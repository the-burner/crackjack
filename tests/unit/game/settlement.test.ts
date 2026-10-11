import { describe, it, expect } from 'vitest';
import { settleHand, handBonus, RESULT } from '@/game/engine/settlement';
import { rulesFrom } from '@/game/engine/rules';
import type { Rules } from '@/game/engine/rules';
import { Hand } from '@/game/engine/hand';
import { Settings } from '@/settings/store';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import type { SettingsPatch } from '@/settings/schema';
import { Storage, MemoryBackend } from '@/services/storage';
import { cardId } from '@/core/cards';
import type { CardId } from '@/core/cards';

const SPADES = 0,
  CLUBS = 1,
  HEARTS = 2,
  DIAMONDS = 3;
const card = (rank: number, suit = SPADES) => cardId(rank, suit);

function makeRules(overrides: SettingsPatch = {}) {
  const settings = new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));
  settings.update(overrides);
  return rulesFrom(settings);
}

function hand(cards: CardId[], { bet = 10, ...rest }: Partial<Hand> = {}) {
  const h = new Hand({ seat: 1, bet });
  for (const c of cards) h.addCard(c);
  Object.assign(h, rest);
  return h;
}

/** A finished dealer hand, which has no bet of its own. */
const dealer = (...cards: CardId[]) => hand(cards, { bet: 0 });
const dealerBlackjackHand = () => dealer(card(1, CLUBS), card(13, CLUBS));
const settle = (rules: Rules, player: Hand, dealerHand: Hand, dealerBlackjack = false) =>
  settleHand({ rules, hand: player, dealer: dealerHand, dealerBlackjack });

describe('insurance', () => {
  it('pays 2:1 and returns its own stake against a dealer blackjack', () => {
    const insured = hand([card(10), card(6)], { insuranceBet: 5 });
    expect(settle(makeRules(), insured, dealerBlackjackHand(), true)).toEqual({
      payout: 15,
      result: RESULT.lose,
      net: 0,
    });
  });

  it('loses the insurance stake when the dealer has no blackjack', () => {
    const insured = hand([card(10), card(9)], { insuranceBet: 5 });
    expect(settle(makeRules(), insured, dealer(card(10, CLUBS), card(10, DIAMONDS)))).toEqual({
      payout: 0,
      result: RESULT.lose,
      net: -15,
    });
  });
});

describe('a dealer blackjack', () => {
  const doubled = () => hand([card(10), card(6)], { doubled: true, doubleBet: 10 });

  it('takes the double as well where a dealer blackjack wins all', () => {
    expect(
      settle(makeRules({ 'rules.dealerBlackjackWinsAll': true }), doubled(), dealerBlackjackHand(), true),
    ).toMatchObject({ payout: 0, result: RESULT.lose, net: -20 });
  });

  it("returns a double's extra wager when only original bets lose", () => {
    expect(settle(makeRules(), doubled(), dealerBlackjackHand(), true)).toMatchObject({
      payout: 10,
      result: RESULT.lose,
      net: -10,
    });
  });

  it('takes everything from a late surrender, but still returns half from an early one', () => {
    const surrendered = () => hand([card(10), card(6)], { surrendered: true });
    expect(settle(makeRules({ 'rules.surrender': 'late' }), surrendered(), dealerBlackjackHand(), true)).toMatchObject({
      payout: 0,
      result: RESULT.surrender,
    });
    expect(settle(makeRules({ 'rules.surrender': 'early' }), surrendered(), dealerBlackjackHand(), true)).toMatchObject(
      { payout: 5, result: RESULT.surrender },
    );
  });
});

describe('a split ten and ace counted as a blackjack', () => {
  const rules = makeRules({ 'bonuses.splitTenAceIsBlackjack': true });
  const splitAce = (cards: CardId[], extra: Partial<Hand> = {}) => hand(cards, { splitCount: 1, ...extra });

  it('pays the blackjack premium, where without the rule it is a plain win', () => {
    const cards = [card(1), card(13, HEARTS)];
    expect(settle(rules, splitAce(cards), dealer(card(10, CLUBS), card(10, DIAMONDS)))).toMatchObject({
      payout: 25,
      result: RESULT.blackjack,
    });
    expect(settle(makeRules(), splitAce(cards), dealer(card(10, CLUBS), card(10, DIAMONDS)))).toMatchObject({
      payout: 20,
      result: RESULT.win,
    });
  });

  it('pushes against a dealer blackjack', () => {
    expect(settle(rules, splitAce([card(1), card(13, HEARTS)]), dealerBlackjackHand(), true)).toMatchObject({
      payout: 10,
      result: RESULT.push,
    });
  });

  it('needs exactly two cards making 21', () => {
    const threeCards = splitAce([card(5), card(6, HEARTS), card(10, DIAMONDS)]);
    expect(settle(rules, threeCards, dealer(card(10, CLUBS), card(10, DIAMONDS)))).toMatchObject({
      result: RESULT.win,
    });
    const nineteen = splitAce([card(10), card(9, HEARTS)]);
    expect(settle(rules, nineteen, dealer(card(10, CLUBS), card(9, DIAMONDS)))).toMatchObject({ result: RESULT.push });
  });
});

describe('equal totals', () => {
  const twenty = () => hand([card(10), card(10, HEARTS)]);
  const dealerTwenty = () => dealer(card(10, CLUBS), card(10, DIAMONDS));

  it('pushes by default', () => {
    expect(settle(makeRules(), twenty(), dealerTwenty())).toMatchObject({ payout: 10, result: RESULT.push });
  });

  it('gives the dealer every tie where the table says so', () => {
    expect(settle(makeRules({ 'rules.dealerWinsTies': true }), twenty(), dealerTwenty())).toMatchObject({
      payout: 0,
      result: RESULT.lose,
      net: -10,
    });
  });

  it('gives the dealer a tied 17 only', () => {
    const rules = makeRules({ 'rules.dealerWinsTied17': true });
    expect(settle(rules, hand([card(10), card(7, HEARTS)]), dealer(card(10, CLUBS), card(7, DIAMONDS)))).toMatchObject({
      result: RESULT.lose,
    });
    expect(settle(rules, hand([card(10), card(8, HEARTS)]), dealer(card(10, CLUBS), card(8, DIAMONDS)))).toMatchObject({
      result: RESULT.push,
    });
  });

  it('gives the dealer ties from 17 to 19, and no others', () => {
    const rules = makeRules({ 'rules.dealerWinsTies17to19': true });
    expect(settle(rules, hand([card(10), card(7, HEARTS)]), dealer(card(10, CLUBS), card(7, DIAMONDS)))).toMatchObject({
      result: RESULT.lose,
    });
    expect(settle(rules, hand([card(10), card(9, HEARTS)]), dealer(card(10, CLUBS), card(9, DIAMONDS)))).toMatchObject({
      result: RESULT.lose,
    });
    expect(settle(rules, twenty(), dealerTwenty())).toMatchObject({ result: RESULT.push });
    expect(settle(rules, hand([card(10), card(6, HEARTS)]), dealer(card(10, CLUBS), card(6, DIAMONDS)))).toMatchObject({
      result: RESULT.push,
    });
  });
});

describe('the 777 bonus', () => {
  const sevens = (...suits: number[]) => hand(suits.map(suit => card(7, suit)));

  it('pays 10:1 for a suited 777, and nothing for an unsuited one', () => {
    const rules = makeRules({ 'bonuses.sevens777': 'suited10:1' });
    expect(handBonus(rules, sevens(HEARTS, HEARTS, HEARTS))).toMatchObject({ multiplier: 10, name: 'Suited 777' });
    expect(handBonus(rules, sevens(SPADES, CLUBS, HEARTS))).toBe(null);
  });

  it('pays 2:1 for any 777, suited or not', () => {
    const rules = makeRules({ 'bonuses.sevens777': '2:1' });
    expect(handBonus(rules, sevens(SPADES, CLUBS, HEARTS))).toMatchObject({ multiplier: 2, name: '777' });
    expect(handBonus(rules, sevens(HEARTS, HEARTS, HEARTS))).toMatchObject({ multiplier: 2, name: '777' });
  });

  it('pays 3:2 for any 777 where the table pays that', () => {
    expect(handBonus(makeRules({ 'bonuses.sevens777': '3:2' }), sevens(SPADES, CLUBS, HEARTS))).toMatchObject({
      multiplier: 1.5,
      name: '777',
    });
  });

  it('pays nothing when the table offers no 777 bonus', () => {
    expect(handBonus(makeRules(), sevens(SPADES, CLUBS, HEARTS))).toBe(null);
  });

  it('settles as a bonus, paid on the bet regardless of the dealer', () => {
    const rules = makeRules({ 'bonuses.sevens777': '2:1' });
    expect(settle(rules, sevens(SPADES, CLUBS, HEARTS), dealer(card(10, CLUBS), card(10, DIAMONDS)))).toMatchObject({
      payout: 30,
      result: RESULT.bonus,
      net: 20,
    });
  });
});

describe('a 21 made of many cards', () => {
  const five21 = () => hand([card(5), card(4, HEARTS), card(3, DIAMONDS), card(2, CLUBS), card(7, HEARTS)]);
  const six21 = () =>
    hand([card(5), card(4, HEARTS), card(3, DIAMONDS), card(2, CLUBS), card(6, HEARTS), card(1, DIAMONDS)]);

  it('pays 2:1 for a five-card 21 only on five cards', () => {
    const rules = makeRules({ 'bonuses.fiveCard21': true });
    expect(handBonus(rules, five21())).toMatchObject({ multiplier: 2, name: 'Five card 21' });
    expect(handBonus(rules, six21())).toBe(null);
  });

  it('pays 2:1 for a six-card 21 only on six cards', () => {
    const rules = makeRules({ 'bonuses.sixCard21': true });
    expect(handBonus(rules, six21())).toMatchObject({ multiplier: 2, name: 'Six card 21' });
    expect(handBonus(rules, five21())).toBe(null);
  });

  it('pays 2:1 for any 21 of five or more cards', () => {
    const rules = makeRules({ 'bonuses.fivePlusCard21': true });
    expect(handBonus(rules, five21())).toMatchObject({ multiplier: 2, name: 'Five or more card 21' });
    expect(handBonus(rules, six21())).toMatchObject({ multiplier: 2, name: 'Five or more card 21' });
    expect(handBonus(rules, hand([card(5), card(4, HEARTS), card(3, DIAMONDS), card(9, CLUBS)]))).toBe(null);
  });

  it('falls back to the charlie, which pays even money', () => {
    const rules = makeRules({ 'rules.autoWinFiveCards': true });
    const charlie = hand([card(2), card(2, HEARTS), card(2, DIAMONDS), card(2, CLUBS), card(3, HEARTS)]);
    expect(handBonus(rules, charlie)).toMatchObject({ multiplier: 1, name: '5 cards' });
  });

  it('pays nothing on an ordinary hand', () => {
    expect(handBonus(makeRules(), hand([card(10), card(9, HEARTS)]))).toBe(null);
  });
});

describe('Blackjack Switch', () => {
  const rules = () => makeRules({ 'bonuses.game': 2001 });
  const dealer22 = () => dealer(card(10, CLUBS), card(6, DIAMONDS), card(6, CLUBS));

  it('pushes a dealer 22 against every hand still standing', () => {
    expect(settle(rules(), hand([card(10), card(9, HEARTS)]), dealer22())).toMatchObject({
      payout: 10,
      result: RESULT.push,
    });
  });

  it('still pays a blackjack against a dealer 22, and a dealer 23 still busts', () => {
    expect(settle(rules(), hand([card(1), card(13, HEARTS)]), dealer22())).toMatchObject({ result: RESULT.blackjack });
    const dealer23 = dealer(card(10, CLUBS), card(6, DIAMONDS), card(7, CLUBS));
    expect(settle(rules(), hand([card(10), card(9, HEARTS)]), dealer23)).toMatchObject({ result: RESULT.win });
  });

  it('pays a dealer 22 as a bust in other games', () => {
    expect(settle(makeRules(), hand([card(10), card(9, HEARTS)]), dealer22())).toMatchObject({ result: RESULT.win });
  });
});

describe('a bonus on a doubled hand', () => {
  // Doubled 11 on four cards, then a 10: a five-card 21.
  const doubled21 = () =>
    hand([card(2), card(3, HEARTS), card(4, DIAMONDS), card(2, CLUBS), card(10, HEARTS)], { doubleBet: 10 });
  const dealer20 = () => dealer(card(10, CLUBS), card(10, DIAMONDS));

  it('pays the bonus on the bet and returns the double, as the original did', () => {
    const rules = makeRules({ 'bonuses.fiveCard21': true });
    expect(settle(rules, doubled21(), dealer20())).toMatchObject({ payout: 10 * 3 + 10, result: RESULT.bonus });
  });

  it('pays a charlie win on the double too, as an ordinary win', () => {
    const rules = makeRules({ 'rules.autoWinFiveCards': true });
    expect(settle(rules, doubled21(), dealer20())).toMatchObject({ payout: 40, result: RESULT.bonus });
  });
});

describe('a bonus against a dealer blackjack found late (no hole card)', () => {
  const charlie = (index = 0) =>
    Object.assign(hand([card(2), card(3, HEARTS), card(4, DIAMONDS), card(2, CLUBS), card(5, HEARTS)]), { index });
  const rules = () => makeRules({ 'rules.noHoleCard': true, 'rules.autoWinFiveCards': true });

  it("is still paid on the seat's first hand", () => {
    expect(settle(rules(), charlie(), dealerBlackjackHand(), true)).toMatchObject({ payout: 20, result: RESULT.bonus });
  });

  it('is not paid on a hand split from it, which the dealer returns', () => {
    expect(settle(rules(), charlie(1), dealerBlackjackHand(), true)).toMatchObject({ result: RESULT.push });
  });
});
