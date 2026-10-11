// The shoe, burn, peeking and face-down behaviour the table screen plays out,
// checked on the engine and session, and on the table state and shown count
// the screen's replay drives.

import { describe, it, expect } from 'vitest';
import { BlackjackGame, ACTION, STATE } from '@/game/engine/game';
import type { TableConfig } from '@/game/engine/game';
import type { GameEvent } from '@/game/engine/events';
import { rulesFrom } from '@/game/engine/rules';
import type { Rules } from '@/game/engine/rules';
import { PLAYER } from '@/game/engine/hand';
import { GameSession } from '@/game/session';
import { createTableState } from '@/game/table/table-state';
import { createShownCount } from '@/game/table/shown-count';
import { planSteps } from '@/game/table/animator';
import { createServices } from '@/app/app';
import { Settings } from '@/settings/store';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import type { SettingsPatch } from '@/settings/schema';
import { Storage, MemoryBackend } from '@/services/storage';
import { Counter } from '@/core/counting';
import { cardId } from '@/core/cards';
import type { CardId } from '@/core/cards';
import { seededRandom } from '@/core/random';
import type { Random } from '@/core/random';

const card = (rank: number, suit = 0) => cardId(rank, suit);
const PAUSES = { dealer: 0, player: 0, payoff: 0 };

function makeRules(overrides: SettingsPatch = {}) {
  const settings = new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));
  settings.update(overrides);
  return rulesFrom(settings);
}

function makeGame({
  table = {},
  rules = makeRules(),
  random = seededRandom(3),
}: { table?: Partial<TableConfig>; rules?: Rules; random?: Random } = {}) {
  return new BlackjackGame({
    rules,
    table: { decks: 6, burnCards: 0, seatCount: 1, computerSeats: [], doubleDownCardFaceUp: true, ...table },
    bankroll: 1000,
    random,
  });
}

/** A game whose shoe deals the given cards in order, then falls back to random. */
function riggedGame(cards: CardId[], options: Parameters<typeof makeGame>[0] = {}) {
  const game = makeGame(options);
  game.takeEvents();
  const queue = [...cards];
  const realDraw = game.shoe.draw.bind(game.shoe);
  game.shoe.draw = () => {
    if (queue.length === 0) return realDraw();
    const next = queue.shift() as CardId;
    game.shoe.remainingByCard[next] -= 1;
    game.shoe.remaining -= 1;
    game.shoe.dealt += 1;
    return next;
  };
  return game;
}

/** Plays a round out to its payoff, standing, and returns its events. */
function playRound(game: BlackjackGame, bets = [{ seat: 1, bet: 10 }]) {
  const events = [...game.startRound(bets)];
  while (game.state === STATE.insurance) events.push(...game.declineInsurance());
  while (game.state === STATE.playerAction) events.push(...game.act(ACTION.stand));
  return events;
}

function makeApp(settings: SettingsPatch = {}) {
  const app = createServices({ backend: new MemoryBackend() });
  // A silent stand-in for the Web Audio player.
  app.sound = { play() {} } as unknown as typeof app.sound;
  app.settings.update({ 'table.seatCount': 1, 'table.computerSeats': [false, false, false, false, false, false] });
  app.settings.update(settings);
  return app;
}

/** The table state and readout count, fed events as the screen replays them. */
function replay(session: GameSession) {
  const state = createTableState({ decks: session.table.decks });
  const shown = createShownCount({
    strategy: session.strategy,
    settings: session.trueCountSettings(),
    decks: session.table.decks,
  });
  return {
    state,
    shown,
    play(events: GameEvent[]) {
      for (const { event } of planSteps(events, { pauses: PAUSES })) {
        state.apply(event);
        shown.see(event, state.dealt);
      }
    },
  };
}

/** What the cards are worth to a fresh shoe, by the session's counting system. */
function countOf(session: GameSession, cards: CardId[]) {
  const counter = new Counter(session.strategy, session.trueCountSettings());
  counter.reset(session.table.decks);
  cards.forEach(c => counter.addCard(c, 1));
  return counter.running;
}

const burnsOf = (events: GameEvent[]) => events.flatMap(e => (e.type === 'burn' ? [e] : []));

describe('opening burn cards', () => {
  it('burns nothing when set to 0', () => {
    const session = new GameSession(makeApp({ 'table.burnCards': 0 }));
    const table = replay(session);
    const events = session.game.takeEvents();
    expect(events.map(e => e.type)).toEqual(['shuffle']);
    table.play(events);
    expect(session.game.shoe.remaining).toBe(312);
    expect(table.state.trayCards).toBe(0);
    expect(table.shown.running).toBe(0);
  });

  it('shows and counts three, then puts them in the tray', () => {
    const session = new GameSession(makeApp({ 'table.burnCards': 3, 'table.showBurnCards': true }));
    const table = replay(session);
    const events = session.game.takeEvents();
    const burns = burnsOf(events);
    expect(burns).toHaveLength(3);
    expect(burns.every(b => b.faceUp)).toBe(true);
    table.play(events);
    expect(session.game.shoe.remaining).toBe(309);
    expect(table.state.burns).toEqual([]);
    expect(table.state.trayCards).toBe(3);
    const expected = countOf(
      session,
      burns.map(b => b.card),
    );
    expect(table.shown.running).toBe(expected);
    expect(session.counts.runningCount).toBe(expected);
  });

  it('deals a hidden one face down into the tray, and does not count it', () => {
    // A burn card that would count if seen.
    let session = new GameSession(makeApp({ 'table.showBurnCards': false }));
    for (let i = 0; i < 50 && countOf(session, [burnsOf(session.game.events)[0].card]) === 0; i++) {
      session = new GameSession(makeApp({ 'table.showBurnCards': false }));
    }
    const table = replay(session);
    const events = session.game.takeEvents();
    const [burn] = burnsOf(events);
    expect(burn.faceUp).toBe(false);
    expect(countOf(session, [burn.card])).not.toBe(0);
    table.play(events);
    expect(table.state.trayCards).toBe(1);
    expect(table.shown.running).toBe(0);
    expect(session.counts.runningCount).toBe(0);
  });
});

describe('insurance', () => {
  it("takes the insurance chips off the seat before the dealer's hand is played out", () => {
    const rules = makeRules({ 'rules.insurance': 'normal', 'rules.dealerPeeksAce': true });
    // Player 10 and 7 against an ace, with a 5 in the hole: no blackjack.
    const game = riggedGame([card(10), card(1), card(7), card(5)], { rules });
    const state = createTableState({ decks: 6 });
    state.setBankroll(995);
    state.setBets([{ seat: 1, amount: 5 }]);
    const events = [...game.startRound([{ seat: 1, bet: 5 }])];
    expect(game.state).toBe(STATE.insurance);
    events.push(...game.takeInsurance());
    while (game.state === STATE.playerAction) events.push(...game.act(ACTION.stand));
    const seen: { amount: number; bank: number; holeUp: boolean }[] = [];
    for (const { event } of planSteps(events, { pauses: PAUSES })) {
      state.apply(event);
      seen.push({
        amount: state.chips.get(1)?.amount ?? 0,
        bank: state.bankroll,
        holeUp: event.type === 'reveal' && event.hand === '0-0' && event.cardIndex === 1,
      });
    }
    const insured = seen.findIndex(s => s.amount === 7.5);
    expect(insured).toBeGreaterThanOrEqual(0);
    // The bankroll paid half the $5 bet.
    expect(seen[insured].bank).toBe(992.5);
    const back = seen.findIndex((s, i) => i > insured && s.amount === 5);
    const reveal = seen.findIndex(s => s.holeUp);
    expect(back).toBeGreaterThan(insured);
    expect(reveal).toBeGreaterThan(back);
  });
});

/** Deals a round whose dealer upcard is a known card. */
function withUpcard(game: BlackjackGame, upcard: CardId) {
  const draw = game.shoe.draw.bind(game.shoe);
  let dealt = 0;
  game.shoe.draw = () => {
    dealt += 1;
    // The upcard is the second card off the shoe with one player seat.
    if (dealt === 2) return upcard;
    return draw();
  };
  return game.startRound([{ seat: 1, bet: 10 }]);
}

describe('peeking at the hole card', () => {
  it('flashes under an ace or a ten when the dealer checks both, and under nothing else', () => {
    const rules = makeRules({ 'rules.dealerPeeksAce': true, 'rules.dealerPeeksTen': true });
    const peeking = {
      mode: 'whenDealerPeeks',
      percent: 100,
      adjacentHands: false,
      randomizeCard: false,
      randomizeHand: false,
    } as const;
    const flashes = (upcard: CardId) =>
      withUpcard(makeGame({ table: { peeking }, rules }), upcard).some(e => e.type === 'peek');
    expect(flashes(card(1))).toBe(true);
    expect(flashes(card(10))).toBe(true);
    expect(flashes(card(13))).toBe(true);
    expect(flashes(card(5))).toBe(false);
    expect(flashes(card(9))).toBe(false);
  });
});

describe('peeking at a neighbour', () => {
  /** The four-seat face-down table: the player in seat 1, computers in 2 to 4. */
  const faceDown = (over: { randomizeCard?: boolean; randomizeHand?: boolean }): Partial<TableConfig> => ({
    cardsFaceDown: true,
    seatCount: 4,
    computerSeats: [2, 3, 4],
    computerBet: 5,
    peeking: { mode: 'off', adjacentHands: true, randomizeCard: false, randomizeHand: false, ...over },
  });

  /** The dealt face-up pattern of seats 2 and 3 over many rounds. */
  function patterns(table: Partial<TableConfig>) {
    const game = makeGame({ table, random: seededRandom(7) });
    const neighbour = new Set<string>();
    const farther = new Set<string>();
    for (let round = 0; round < 30; round++) {
      const events = game.startRound([{ seat: 1, bet: 10 }]);
      // As dealt: a round over at once turns every hand up.
      const faceUp = (key: string) =>
        JSON.stringify(events.flatMap(e => (e.type === 'card' && e.hand === key ? [e.faceUp] : [])).slice(0, 2));
      neighbour.add(faceUp('2-0'));
      farther.add(faceUp('3-0'));
      while (game.state === STATE.insurance) game.declineInsurance();
      while (game.state === STATE.playerAction) game.act(ACTION.stand);
      game.nextRound();
    }
    return { neighbour, farther };
  }

  it("randomize card turns up the neighbour's cards one by one, at random", () => {
    const { neighbour, farther } = patterns(faceDown({ randomizeCard: true }));
    expect([...neighbour].some(p => p.includes('true'))).toBe(true);
    expect([...neighbour].some(p => p.includes('false'))).toBe(true);
    expect(neighbour.has('[true,false]') || neighbour.has('[false,true]')).toBe(true);
    expect([...farther]).toEqual(['[false,false]']);
  });

  it("randomize hand turns up the whole neighbour's hand or none of it", () => {
    const { neighbour } = patterns(faceDown({ randomizeHand: true }));
    expect([...neighbour].sort()).toEqual(['[false,false]', '[true,true]']);
  });
});

describe('players coming and going', () => {
  it('changes the occupied computer seats now and then, and otherwise keeps them', () => {
    const game = makeGame({
      table: { seatCount: 4, computerSeats: [2, 3, 4], computerBet: 5, playersComeAndGo: true },
      random: seededRandom(7),
    });
    const seatings: string[] = [];
    for (let round = 0; round < 300; round++) {
      playRound(game);
      seatings.push(
        game.hands
          .filter(h => h.owner === PLAYER.computer)
          .map(h => h.seat)
          .join(','),
      );
      game.nextRound();
    }
    const changes = seatings.slice(1).filter((s, i) => s !== seatings[i]).length;
    expect(changes).toBeGreaterThan(0);
    // About 7% of rounds; well under a fifth.
    expect(changes).toBeLessThan(60);
  });
});

describe('the cut card', () => {
  /** Plays rounds, noting the cards drawn by the end of each and whether the shoe was reshuffled after. */
  function shoeRounds(cardsBehindCutCard: number, count: number) {
    const game = makeGame({
      table: { decks: 1, shuffleMode: 'cutCard', cardsBehindCutCard, burnCards: 1 },
      random: seededRandom(11),
    });
    game.takeEvents();
    const rounds: { drawn: number; reshuffled: boolean; midRound: boolean }[] = [];
    for (let round = 0; round < count; round++) {
      const midRound = playRound(game).some(e => e.type === 'shuffle');
      const drawn = game.shoe.dealt;
      const reshuffled = game.nextRound().some(e => e.type === 'shuffle');
      rounds.push({ drawn, reshuffled, midRound });
      if (reshuffled) break;
    }
    return rounds;
  }

  it('reshuffles at the end of the round in which the card after penetration came out', () => {
    // First, deep penetration, to learn how many cards each round leaves drawn.
    const learned = shoeRounds(10, 3);
    expect(learned).toHaveLength(3);
    const atPenetration = learned[1].drawn;
    // Then the same deal with the cut card placed right after round 2's last card.
    const rounds = shoeRounds(52 - atPenetration, 4);
    expect(rounds.map(r => r.drawn).slice(0, 2)).toEqual(learned.slice(0, 2).map(r => r.drawn));
    expect(rounds[1].reshuffled).toBe(false);
    expect(rounds[2].reshuffled).toBe(true);
    expect(rounds.some(r => r.midRound)).toBe(false);
  });
});

describe('the count across splits', () => {
  it('counts every card dealt, including the one a split hand draws, in an unshuffled shoe', () => {
    const session = new GameSession(
      makeApp({
        'table.decks': 8,
        'table.shuffleMode': 'rounds',
        'table.roundsPerShoe': 80,
        'table.burnCards': 1,
        'table.showBurnCards': true,
        'table.seatCount': 4,
        'table.computerSeats': [false, true, true, true, false, false],
        'rules.surrender': 'none',
      }),
    );
    session.game.random = seededRandom(5);
    session.game.shoe.random = seededRandom(6);
    const table = replay(session);
    const opening = session.game.takeEvents();
    table.play(opening);
    // In a face-up game every card dealt is seen by the end of its round.
    const seen = burnsOf(opening).map(b => b.card);
    let splits = 0;
    for (let round = 0; round < 200 && splits < 4; round++) {
      table.state.setBets([{ seat: 1, amount: 10 }]);
      const events = [...session.startRound({ betPerHand: 10 })];
      while (session.state === STATE.insurance) events.push(...session.declineInsurance());
      while (session.state === STATE.playerAction) {
        events.push(...session.act(session.availableActions().split ? ACTION.split : ACTION.stand));
      }
      table.play(events);
      seen.push(...[session.game.dealer, ...session.game.hands].flatMap(h => h.cards));
      if (session.game.hands.some(h => h.key.endsWith('-1'))) splits += 1;
      const expected = countOf(session, seen);
      expect(table.shown.running, `round ${round}: the readout`).toBe(expected);
      expect(session.counts.runningCount, `round ${round}: the Stats count`).toBe(expected);
      table.play(session.nextRound());
    }
    expect(splits).toBe(4);
  });
});
