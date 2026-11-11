// The table rules added for casino games: surrender except against an ace, resplitting aces once,
// unlimited resplits, no ten splits, and a cut card that varies.
import { describe, it, expect } from 'vitest';
import { rulesFrom, splitAllowed, surrenderAllowed, earlySurrenderAllowed } from '@/game/engine/rules';
import { Hand } from '@/game/engine/hand';
import { Shoe } from '@/game/engine/shoe';
import { Settings } from '@/settings/store';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import type { SettingValues } from '@/settings/schema';
import { Storage, MemoryBackend } from '@/services/storage';
import { cardId } from '@/core/cards';
import type { CardId } from '@/core/cards';
import { seededRandom } from '@/core/random';
import { applyRuleChange } from '@/settings/rules-logic';
import { splitColumn, MOST_HANDS_PER_SEAT } from '@/game/table/layout';

const card = (rank: number, suit = 0) => cardId(rank, suit);
const ACE = card(1);
const TEN = card(10);

function makeRules(overrides: Partial<SettingValues> = {}) {
  const settings = new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));
  settings.update(overrides);
  return rulesFrom(settings);
}

function hand(cards: CardId[], extra: Partial<Hand> = {}) {
  const h = new Hand({ seat: 1, bet: 10 });
  for (const c of cards) h.addCard(c);
  Object.assign(h, extra);
  return h;
}

describe('surrender except against an ace', () => {
  it('early: before the dealer checks against 2 to 10, never against an ace', () => {
    const rules = makeRules({ 'rules.surrender': 'earlyExceptAce' });
    const sixteen = hand([card(10), card(6)]);
    expect(earlySurrenderAllowed(rules, TEN)).toBe(true);
    expect(earlySurrenderAllowed(rules, ACE)).toBe(false);
    expect(surrenderAllowed(rules, sixteen, { upcard: TEN })).toBe(true);
    expect(surrenderAllowed(rules, sixteen, { upcard: ACE })).toBe(false);
  });

  it('late: after the dealer checks against 2 to 10, never against an ace', () => {
    const rules = makeRules({ 'rules.surrender': 'lateExceptAce' });
    const sixteen = hand([card(10), card(6)]);
    expect(earlySurrenderAllowed(rules, TEN)).toBe(false);
    expect(surrenderAllowed(rules, sixteen, { upcard: card(9) })).toBe(true);
    expect(surrenderAllowed(rules, sixteen, { upcard: ACE })).toBe(false);
  });
});

describe('splitting', () => {
  const aces = hand([ACE, card(1, 1)], { splitCount: 1 });

  it('resplits aces once only, to three hands, when that is the rule', () => {
    const rules = makeRules({ 'rules.resplitAces': true, 'rules.resplitAcesOnce': true, 'rules.maxSplitHands': 4 });
    expect(splitAllowed(rules, aces, 2)).toBe(true);
    expect(splitAllowed(rules, aces, 3)).toBe(false);
    // Other pairs still go to four.
    expect(splitAllowed(rules, hand([card(8), card(8, 1)], { splitCount: 1 }), 3)).toBe(true);
  });

  it('resplits to eight hands with unlimited resplits, laid out without two hands in one place', () => {
    const rules = makeRules({ 'rules.maxSplitHands': 8 });
    const eights = hand([card(8), card(8, 1)], { splitCount: 1 });
    expect(splitAllowed(rules, eights, 7)).toBe(true);
    expect(splitAllowed(rules, eights, 8)).toBe(false);
    expect(new Set(Array.from({ length: MOST_HANDS_PER_SEAT }, (_, i) => splitColumn(i))).size).toBe(8);
  });

  it('never splits tens with no ten splits, whatever their rank', () => {
    const rules = makeRules({ 'rules.noTenSplits': true });
    expect(splitAllowed(rules, hand([TEN, card(10, 1)]), 1)).toBe(false);
    expect(splitAllowed(rules, hand([card(13), card(12)]), 1)).toBe(false);
    expect(splitAllowed(rules, hand([card(8), card(8, 1)]), 1)).toBe(true);
  });

  it('turns resplitting aces on with resplitting them once, and off with it', () => {
    const read = (values: Partial<SettingValues>) => (key: keyof SettingValues) =>
      (values[key] ?? SETTINGS_SCHEMA[key].default) as never;
    expect(applyRuleChange(read({ 'rules.maxSplitHands': 2 }), 'rules.resplitAcesOnce', true)).toMatchObject({
      'rules.resplitAcesOnce': true,
      'rules.resplitAces': true,
      'rules.maxSplitHands': 4,
    });
    expect(applyRuleChange(read({ 'rules.resplitAcesOnce': true }), 'rules.resplitAces', false)).toMatchObject({
      'rules.resplitAcesOnce': false,
    });
  });
});

describe('a cut card that varies', () => {
  it('lands within the variation of where it is set, differently from shoe to shoe', () => {
    const shoe = new Shoe({ decks: 6, cardsBehindCutCard: 78, cutCardVaries: 13, random: seededRandom(5) });
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) {
      shoe.shuffle();
      expect(shoe.cutCardAt).toBeGreaterThanOrEqual(65);
      expect(shoe.cutCardAt).toBeLessThanOrEqual(91);
      expect(shoe.penetration).toBe(312 - shoe.cutCardAt);
      seen.add(shoe.cutCardAt);
    }
    expect(seen.size).toBeGreaterThan(10);
  });

  it('stays put, and draws nothing from the random sequence, when it does not vary', () => {
    let draws = 0;
    const shoe = new Shoe({ decks: 6, cardsBehindCutCard: 78, random: () => (draws++, 0.5) });
    shoe.shuffle();
    expect(shoe.cutCardAt).toBe(78);
    expect(draws).toBe(0);
  });
});
