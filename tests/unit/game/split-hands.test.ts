// Split hands on screen: played, and paid, from right to left as the player sees them, each keeping its place.
import { describe, it, expect } from 'vitest';
import { BlackjackGame, ACTION, STATE } from '@/game/engine/game';
import type { GameOptions, GameAction, TableConfig } from '@/game/engine/game';
import type { GameEvent } from '@/game/engine/events';
import type { Hand, HandKey } from '@/game/engine/hand';
import { rulesFrom } from '@/game/engine/rules';
import { planSteps } from '@/game/table/choreography';
import { createTableState } from '@/game/table/table-state';
import { tableLayout, handSlot } from '@/game/table/layout';
import { Settings } from '@/settings/store';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import type { SettingsPatch } from '@/settings/schema';
import { Storage, MemoryBackend } from '@/services/storage';
import { cardId } from '@/core/cards';
import type { CardId } from '@/core/cards';
import { seededRandom } from '@/core/random';

const PAUSES = { dealer: 500, player: 200, payoff: 700 };
const card = (rank: number, suit = 0) => cardId(rank, suit);
const layout = tableLayout({ width: 844, height: 390, seatCount: 2, humanSeats: [1] });

function makeRules(overrides: SettingsPatch = {}) {
  const settings = new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));
  settings.update(overrides);
  return rulesFrom(settings);
}

interface Frame {
  pointer: HandKey | null;
  /** Each hand's left edge on screen. */
  x: Map<HandKey, number>;
  /** The hand whose result was just shown, if any. */
  paid: HandKey | null;
}

/**
 * Plays a round with stacked cards: seat 1 the player (who plays `player`), seat 2 a computer
 * (which splits every pair it may, and otherwise stands). Returns what the screen showed after each step.
 */
function playRound(
  cards: CardId[],
  {
    player = () => ACTION.stand,
    rules = {},
    table = {},
  }: { player?: (hand: Hand) => GameAction; rules?: SettingsPatch; table?: Partial<TableConfig> } = {},
) {
  const options: GameOptions = {
    rules: makeRules({ 'rules.maxSplitHands': 4, 'rules.resplitAces': true, ...rules }),
    table: { decks: 6, burnCards: 0, seatCount: 2, computerSeats: [2], doubleDownCardFaceUp: true, ...table },
    bankroll: 1000,
    random: seededRandom(1),
    // A split it may not make is played as a stand.
    computerPlay: hand => (hand.cardCount === 2 && hand.values[0] === hand.values[1] ? ACTION.split : ACTION.stand),
  };
  const game = new BlackjackGame(options);
  game.takeEvents();
  const queue = [...cards];
  const realDraw = game.shoe.draw.bind(game.shoe);
  game.shoe.draw = () => {
    const next = queue.shift();
    if (next === undefined) return realDraw();
    game.shoe.remainingByCard[next] -= 1;
    game.shoe.remaining -= 1;
    game.shoe.dealt += 1;
    return next;
  };
  const state = createTableState({ decks: 6 });
  state.setBets([{ seat: 1, amount: 10 }]);
  const frames: Frame[] = [];
  const swept = new Set<HandKey>();
  const show = (events: GameEvent[]) => {
    for (const step of planSteps(events, { pauses: PAUSES, isComputer: key => key.startsWith('2-'), swept })) {
      state.apply(step.event);
      const x = new Map<HandKey, number>();
      for (const hand of state.hands) x.set(hand.key, handSlot(layout, hand.key, 0, state.seatOrder.get(hand.seat))!.x);
      const paid = step.event.type === 'settled' || step.event.type === 'result' ? step.event.hand : null;
      frames.push({ pointer: state.pointerHand, x, paid });
    }
  };
  show(game.startRound([{ seat: 1, bet: 10 }]));
  for (let i = 0; i < 20 && game.state === STATE.playerAction; i++) show(game.act(player(game.activeHand!)));
  return { frames, game };
}

/** The order the pointer visited a seat's hands in. */
const visits = (frames: Frame[], seat: number) =>
  frames
    .map(f => f.pointer)
    .filter((key, i, all): key is HandKey => !!key && key.startsWith(`${seat}-`) && key !== all[i - 1]);
/** A hand's place on screen once the seat has all its hands. */
const finalX = (frames: Frame[], key: HandKey) => frames.findLast(f => f.x.has(key))!.x.get(key)!;
/** True when each hand sits further left than the one before. */
const rightToLeft = (frames: Frame[], keys: HandKey[]) =>
  keys.every((key, i) => i === 0 || finalX(frames, key) < finalX(frames, keys[i - 1]));

// Deal order: player, computer, up card; player, computer, hole card. The dealer has 7 and 10: it stands.
const DEAL = (player: CardId[], computer: CardId[]) => [
  player[0],
  computer[0],
  card(7),
  player[1],
  computer[1],
  card(10),
];

describe('a computer seat that splits', () => {
  it('into two: plays the right hand, then the left', () => {
    const { frames } = playRound([...DEAL([card(10), card(9)], [card(8), card(8, 1)]), card(3), card(5)]);
    const order = visits(frames, 2);
    expect(order).toEqual(['2-0', '2-1']);
    expect(rightToLeft(frames, order)).toBe(true);
  });

  it('again on its first hand: plays the new hand next, just left of it, and the far hand last', () => {
    // 8-8 splits; the first hand draws another 8 and splits again.
    const { frames } = playRound([
      ...DEAL([card(10), card(9)], [card(8), card(8, 1)]),
      card(8, 2),
      card(3),
      card(5),
      card(2),
    ]);
    const order = visits(frames, 2);
    expect(order).toHaveLength(3);
    expect(rightToLeft(frames, order)).toBe(true);
  });

  it('again on its second hand: still right to left', () => {
    // The first hand draws a 3; the second draws an 8 and splits again.
    const { frames } = playRound([
      ...DEAL([card(10), card(9)], [card(8), card(8, 1)]),
      card(3),
      card(8, 2),
      card(5),
      card(2),
    ]);
    const order = visits(frames, 2);
    expect(order).toHaveLength(3);
    expect(rightToLeft(frames, order)).toBe(true);
  });

  it('into four: right to left throughout', () => {
    const { frames } = playRound([
      ...DEAL([card(10), card(9)], [card(8), card(8, 1)]),
      card(8, 2),
      card(8, 3),
      card(3),
      card(4),
      card(5),
      card(2),
    ]);
    const order = visits(frames, 2);
    expect(order).toHaveLength(4);
    expect(rightToLeft(frames, order)).toBe(true);
  });

  it('pays its hands right to left too, none of them moving while the others are swept', () => {
    const { frames } = playRound([
      ...DEAL([card(10), card(9)], [card(8), card(8, 1)]),
      card(8, 2),
      card(3),
      card(5),
      card(2),
    ]);
    const paidFrom = frames.findIndex(f => f.paid?.startsWith('2-'));
    const paid = frames
      .slice(paidFrom)
      .map(f => f.paid)
      .filter((key): key is HandKey => !!key?.startsWith('2-'));
    expect(new Set(paid).size).toBe(3);
    expect(rightToLeft(frames, [...new Set(paid)])).toBe(true);
    // From the third hand's arrival to the end of the round, every hand keeps its place.
    const allThere = frames.findIndex(f => [...f.x.keys()].filter(k => k.startsWith('2-')).length === 3);
    for (const key of ['2-0', '2-1', '2-2'] as HandKey[]) {
      const xs = new Set(frames.slice(allThere).flatMap(f => (f.x.has(key) ? [f.x.get(key)] : [])));
      expect(xs.size, key).toBe(1);
    }
  });
});

describe('the player splitting', () => {
  const splitPairs = (hand: Hand) =>
    hand.cardCount === 2 && hand.values[0] === hand.values[1] ? ACTION.split : ACTION.stand;

  it('again on the first hand, and the second, into four: right to left', () => {
    const { frames } = playRound(
      [...DEAL([card(9), card(9, 1)], [card(10), card(7)]), card(9, 2), card(9, 3), card(2), card(3), card(4), card(5)],
      { player: splitPairs },
    );
    const order = visits(frames, 1);
    expect(order).toHaveLength(4);
    expect(rightToLeft(frames, order)).toBe(true);
  });

  it('aces, which take one card each and are never pointed at for a decision: placed right to left in play order', () => {
    const { frames, game } = playRound(
      [...DEAL([card(1), card(1, 1)], [card(10), card(7)]), card(1, 2), card(9), card(8), card(7)],
      { player: splitPairs, rules: { 'rules.hitSplitAces': false } },
    );
    const played = game.hands.filter(hand => hand.seat === 1).map(hand => hand.key);
    expect(played).toHaveLength(3);
    expect(rightToLeft(frames, played)).toBe(true);
  });
});
