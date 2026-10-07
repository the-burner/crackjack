// The blackjack round, as a state machine with no DOM involvement.
//
// The screen drives it: start a round, read `events` to animate what happened,
// and when `state` is 'playerAction' offer `availableActions()` and call
// `act()`. Everything the UI needs is on the engine's state; the engine never
// waits, so animation speed is entirely the screen's business.

import { valueOf } from '@/core/cards';
import type { CardId } from '@/core/cards';
import { defaultRandom } from '@/core/random';
import type { Random } from '@/core/random';
import type { SideBetGame } from '@/settings/side-bet-games';
import type { SettingValues } from '@/settings/schema';
import { Hand, PLAYER } from './hand';
import type { ShuffleMode } from './shoe';
import { Shoe } from './shoe';
import {
  dealerPeeks,
  insuranceOffered,
  doubleAllowed,
  splitAllowed,
  splitAcesMayDraw,
  splitAcesMayHit,
  surrenderAllowed,
  earlySurrenderAllowed,
  dealerShouldDraw,
  bustValue,
  charlieWin,
  MAX_CARDS_PER_HAND,
} from './rules';
import type { Rules } from './rules';
import { settleHand, RESULT } from './settlement';
import type { Result } from './settlement';
import type { GameEvent, SideBetDetail } from './events';
import { evaluateSideBet, evaluateHandBonus, sideBetSpots } from './side-bets';

/** Whether a bankroll covers a whole round: every hand's bet and every side bet. */
export function checkAffordable({
  bankroll,
  betPerHand,
  hands,
  sideBets = {},
}: {
  bankroll: number;
  betPerHand: number;
  hands: number;
  sideBets?: Record<string, number>;
}): boolean {
  const side = Object.values(sideBets).reduce((sum, amount) => sum + amount, 0);
  return (betPerHand + side) * hands <= bankroll;
}

/** How often "players come and go" empties and refills the table. */
const COME_AND_GO_CHANCE = 0.07;

export const STATE = {
  betting: 'betting',
  dealing: 'dealing',
  insurance: 'insurance',
  playerAction: 'playerAction',
  dealer: 'dealer',
  settled: 'settled',
} as const;
export type GameState = (typeof STATE)[keyof typeof STATE];

export const ACTION = {
  hit: 'hit',
  stand: 'stand',
  double: 'double',
  split: 'split',
  surrender: 'surrender',
} as const;
export type GameAction = (typeof ACTION)[keyof typeof ACTION];

/** Which actions the active hand may take. */
export type AvailableActions = Partial<Record<GameAction, boolean>>;

/** The dealer's seat number. */
const DEALER_SEAT = 0;

/** A computer seat's stake when the table sets none. */
const DEFAULT_COMPUTER_BET = 5;

/** Most decisions a computer hand makes, so a bad decision function cannot loop forever. */
const COMPUTER_DECISION_LIMIT = 12;

/** How the dealer's hole card and a neighbour's cards may be glimpsed. */
export interface PeekingOptions {
  mode?: SettingValues['peeking.mode'];
  percent?: number;
  adjacentHands?: boolean;
  randomizeCard?: boolean;
  randomizeHand?: boolean;
}

/** The table: the shoe, the seats and the dealer's habits. */
export interface TableConfig {
  decks: number;
  shuffleMode?: ShuffleMode;
  cardsBehindCutCard?: number;
  roundsPerShoe?: number;
  burnCards?: number;
  showBurnCards?: boolean;
  seatCount?: number;
  computerSeats?: number[];
  computerBet?: number;
  cardsFaceDown?: boolean;
  doubleDownCardFaceUp?: boolean;
  dealerMakesObviousPlays?: boolean;
  playersComeAndGo?: boolean;
  peeking?: PeekingOptions;
  limits?: SettingValues['table.limits'];
  maxCardsPerHand?: number;
}

/** What a computer seat's decision function is told. */
export interface ComputerPlayContext {
  dealerUpcard: CardId;
  game: BlackjackGame;
}

export interface GameOptions {
  /** From rulesFrom(settings). */
  rules: Rules;
  table: TableConfig;
  bankroll: number;
  random?: Random;
  /** Decides a computer player's action. */
  computerPlay?: ((hand: Hand, context: ComputerPlayContext) => GameAction | null | undefined) | null;
  /** Lets the dealer wrongly bust a good hand. */
  onGoodHandBusted?: ((hand: Hand) => boolean) | null;
  /** Called as each new shoe is shuffled, before its burn cards. */
  onShuffle?: (() => void) | null;
  /** Called for counting. */
  onCardSeen?: ((card: CardId, faceUp: boolean, cardsGone: number) => void) | null;
  /** Decoded side-bet game (settings/side-bet-games.ts). */
  sideBetGame?: SideBetGame | null;
  /** Current true count, for count-gated side-bet rules. */
  trueCount?: () => number;
  /** Return false to make the dealer stand (dealer errors). */
  beforeDealerDraw?: ((dealer: Hand) => boolean) | null;
}

/** A human seat's bet for the round. */
export interface SeatBet {
  seat: number;
  bet: number;
  sideBets?: Record<string, number>;
}

export class BlackjackGame {
  rules: Rules;
  table: TableConfig;
  bankroll: number;
  random: Random;
  computerPlay: GameOptions['computerPlay'];
  onCardSeen: GameOptions['onCardSeen'];
  sideBetGame: SideBetGame | null;
  trueCount: () => number;
  beforeDealerDraw: GameOptions['beforeDealerDraw'];
  onGoodHandBusted: GameOptions['onGoodHandBusted'];
  onShuffle: GameOptions['onShuffle'];
  shoe: Shoe;
  state: GameState;
  events: GameEvent[];
  hands: Hand[];
  dealer: Hand;
  roundNumber: number;
  /** The computer seats taken while "players come and go". */
  seatedComputers?: number[];
  dealerBlackjack = false;
  insuranceDecided = false;
  activeIndex = -1;
  /** Which neighbours' hands are glimpsed this round, when peeking picks by hand. */
  peekedSides: { next: boolean; previous: boolean } | null = null;

  constructor({
    rules,
    table,
    bankroll,
    random = defaultRandom,
    computerPlay = null,
    onCardSeen = null,
    sideBetGame = null,
    trueCount = () => 0,
    beforeDealerDraw = null,
    onGoodHandBusted = null,
    onShuffle = null,
  }: GameOptions) {
    this.rules = rules;
    this.table = table;
    this.bankroll = bankroll;
    this.random = random;
    this.computerPlay = computerPlay;
    this.onCardSeen = onCardSeen;
    this.sideBetGame = sideBetGame;
    this.trueCount = trueCount;
    this.beforeDealerDraw = beforeDealerDraw;
    this.onGoodHandBusted = onGoodHandBusted;
    this.onShuffle = onShuffle;
    this.shoe = new Shoe({ ...table, random });
    this.state = STATE.betting;
    this.events = [];
    this.hands = [];
    this.dealer = new Hand({ seat: DEALER_SEAT });
    this.roundNumber = 0;
    this.shuffleAndBurn();
  }

  // --- events ---------------------------------------------------------------

  emit(event: GameEvent): void {
    this.events.push(event);
  }

  /** Takes the events recorded since the last call. */
  takeEvents(): GameEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  /**
   * Which computer seats are taken this round. With "players come and go" the
   * table empties and refills now and then, as the original did.
   */
  computerSeatsThisRound(): number[] {
    const seats = this.table.computerSeats ?? [];
    if (!this.table.playersComeAndGo || seats.length === 0) return seats;
    if (this.seatedComputers && this.random() > COME_AND_GO_CHANCE) return this.seatedComputers;
    const wanted =
      seats.length === 1
        ? Math.floor(this.random() * 2)
        : Math.min(seats.length, Math.floor(this.random() * seats.length) + 1);
    const free = [...seats];
    const taken: number[] = [];
    while (taken.length < wanted && free.length > 0) {
      taken.push(...free.splice(Math.floor(this.random() * free.length), 1));
    }
    this.seatedComputers = taken.sort((a, b) => a - b);
    return this.seatedComputers;
  }

  // --- shoe -----------------------------------------------------------------

  shuffleAndBurn(): void {
    this.shoe.shuffle();
    // A new shoe starts a new count, before any of its cards is seen.
    this.onShuffle?.();
    this.emit({ type: 'shuffle' });
    const faceUp = Boolean(this.table.showBurnCards);
    for (let i = 0; i < (this.table.burnCards ?? 0); i++) {
      // A fresh shoe always has cards to burn.
      const card = this.shoe.draw()!;
      this.emit({ type: 'burn', card, faceUp });
      if (faceUp) this.onCardSeen?.(card, true, this.shoe.dealt);
    }
  }

  /** Deals one card to a hand, counting it when it is face up. */
  dealTo(hand: Hand, { faceUp = true }: { faceUp?: boolean } = {}): CardId {
    if (this.shoe.remaining === 0) this.shuffleAndBurn();
    // Never empty: an empty shoe was just reshuffled.
    const card = this.shoe.draw()!;
    hand.addCard(card, faceUp);
    this.emit({ type: 'card', hand: hand.key, card, faceUp, cardIndex: hand.cardCount - 1 });
    if (faceUp) this.count(hand, hand.cardCount - 1);
    return card;
  }

  /** Turns a face-down card face up, counting it. */
  reveal(hand: Hand, index: number): void {
    if (hand.faceUp[index]) return;
    hand.faceUp[index] = true;
    this.emit({ type: 'reveal', hand: hand.key, cardIndex: index, card: hand.cards[index] });
    this.count(hand, index);
  }

  /** Counts a card the player can see, once. */
  count(hand: Hand, index: number): void {
    if (hand.counted[index]) return;
    hand.counted[index] = true;
    this.onCardSeen?.(hand.cards[index], true, this.shoe.dealt);
  }

  // --- round ----------------------------------------------------------------

  /** Starts a round. `bets` are the bets for the human seats. */
  startRound(bets: SeatBet[]): GameEvent[] {
    this.roundNumber += 1;
    this.dealer = new Hand({ seat: DEALER_SEAT });
    this.hands = [];
    this.dealerBlackjack = false;
    this.insuranceDecided = false;
    this.activeIndex = -1;

    for (const { seat, bet, sideBets = {} } of bets) {
      if (bet <= 0) continue;
      const hand = new Hand({ seat, owner: PLAYER.human, bet });
      hand.bustCeiling = bustValue(this.rules);
      hand.sideBets = { ...sideBets };
      this.hands.push(hand);
      this.bankroll -= hand.wagered;
    }
    for (const seat of this.computerSeatsThisRound()) {
      if (seat > (this.table.seatCount ?? 0)) continue;
      const hand = new Hand({ seat, owner: PLAYER.computer, bet: this.table.computerBet ?? DEFAULT_COMPUTER_BET });
      hand.bustCeiling = bustValue(this.rules);
      this.hands.push(hand);
    }
    this.hands.sort((a, b) => a.seat - b.seat || a.index - b.index);

    this.state = STATE.dealing;
    this.emit({ type: 'roundStart', round: this.roundNumber });
    this.deal();
    return this.takeEvents();
  }

  deal(): void {
    this.peekedSides = this.peeking().randomizeHand
      ? { next: this.random() < 0.5, previous: this.random() < 0.5 }
      : null;
    for (let pass = 0; pass < 2; pass++) {
      for (const hand of this.hands) this.dealTo(hand, { faceUp: this.dealtFaceUp(hand) });
      if (pass === 0) this.dealTo(this.dealer, { faceUp: true });
      else if (!this.rules.noHoleCard) this.dealTo(this.dealer, { faceUp: false });
    }
    this.emit({ type: 'dealt', upcard: this.dealer.cards[0] });
    this.maybePeekHoleCard();

    const playerHasTwentyOne = this.humanHands().some(h => h.total === 21);
    if (insuranceOffered(this.rules, this.dealer.cards[0], playerHasTwentyOne)) {
      this.state = STATE.insurance;
      this.emit({ type: 'offerInsurance' });
      return;
    }
    this.afterInsurance();
  }

  peeking(): PeekingOptions {
    return this.table.peeking ?? {};
  }

  /** Whether a player's card is dealt face up: in a face-down game, a neighbour's may be. */
  dealtFaceUp(hand: Hand): boolean {
    if (!this.table.cardsFaceDown) return true;
    const peeking = this.peeking();
    if (!peeking.adjacentHands || hand.owner === PLAYER.human) return false;
    const humanBeside = (side: number) => this.hands.some(h => h.owner === PLAYER.human && h.seat === hand.seat + side);
    for (const [side, key] of [
      [1, 'next'],
      [-1, 'previous'],
    ] as const) {
      if (!humanBeside(side)) continue;
      if (peeking.randomizeHand) {
        if (this.peekedSides?.[key]) return true;
      } else if (!peeking.randomizeCard || this.random() > 0.5) {
        return true;
      }
    }
    return false;
  }

  /** The dealer's hole card may flash face up for a moment as it is dealt. */
  maybePeekHoleCard(): void {
    const { mode = 'off', percent = 100 } = this.peeking();
    if (mode === 'off' || this.rules.noHoleCard || this.dealer.cardCount < 2) return;
    if (mode === 'whenDealerPeeks' && !dealerPeeks(this.rules, this.dealer.cards[0])) return;
    if (this.random() * 100 <= 100 - percent) return;
    const card = this.dealer.cards[1];
    this.emit({ type: 'peek', hand: this.dealer.key, cardIndex: 1, card });
    this.emit({ type: 'conceal', hand: this.dealer.key, cardIndex: 1 });
    this.count(this.dealer, 1);
  }

  /** What taking insurance would cost, over every hand that has a bet. */
  insuranceCost(): number {
    return this.humanHands().reduce((sum, hand) => sum + hand.bet / 2, 0);
  }

  /** Whether insurance can be paid for. */
  canInsure(): boolean {
    return this.state === STATE.insurance && this.bankroll >= this.insuranceCost();
  }

  /** Takes insurance on every human hand that has a bet. */
  takeInsurance(): GameEvent[] {
    if (this.state !== STATE.insurance) return this.takeEvents();
    if (!this.canInsure()) return this.takeEvents();
    for (const hand of this.humanHands()) {
      hand.insuranceBet = hand.bet / 2;
      this.bankroll -= hand.insuranceBet;
    }
    this.emit({ type: 'insuranceTaken' });
    this.afterInsurance();
    return this.takeEvents();
  }

  declineInsurance(): GameEvent[] {
    if (this.state !== STATE.insurance) return this.takeEvents();
    this.emit({ type: 'insuranceDeclined' });
    this.afterInsurance();
    return this.takeEvents();
  }

  afterInsurance(): void {
    this.insuranceDecided = true;
    // The dealer checks the hole card where the rules say so.
    if (dealerPeeks(this.rules, this.dealer.cards[0])) {
      if (this.dealer.total === 21) {
        this.dealerBlackjack = true;
        this.reveal(this.dealer, 1);
        // Announced once the hole card is up, as the original did at its showdown.
        this.emit({ type: 'message', text: 'Dealer has Blackjack' });
        this.finishRound();
        return;
      }
      if (this.humanHands().some(hand => hand.insuranceBet > 0)) this.emit({ type: 'insuranceLost' });
    }
    this.state = STATE.playerAction;
    this.advance();
  }

  humanHands(): Hand[] {
    return this.hands.filter(h => h.owner === PLAYER.human);
  }

  handsInSeat(seat: number): number {
    return this.hands.filter(h => h.seat === seat).length;
  }

  get activeHand(): Hand | null {
    return this.hands[this.activeIndex] ?? null;
  }

  /** Moves to the next hand that needs attention, then plays out the dealer. */
  advance(): void {
    for (let i = this.activeIndex + 1; i < this.hands.length; i++) {
      const hand = this.hands[i];
      this.activeIndex = i;
      // A split hand still needs its second card.
      if (hand.cardCount === 1) this.dealTo(hand, { faceUp: this.dealtFaceUp(hand) });
      if (hand.owner === PLAYER.human) this.revealHand(hand);

      if (hand.isNatural()) {
        // A blackjack is shown before it is announced, whoever holds it.
        this.revealHand(hand);
        this.emit({ type: 'message', text: 'Blackjack', hand: hand.key });
        continue;
      }
      if (!splitAcesMayDraw(this.rules, hand)) {
        hand.stood = true;
        continue;
      }
      if (hand.owner === PLAYER.computer) {
        this.emit({ type: 'turn', hand: hand.key });
        this.playComputerHand(hand);
        continue;
      }
      if (hand.busted() || hand.stood || hand.surrendered) continue;
      if (this.obviousStand(hand)) {
        hand.stood = true;
        continue;
      }
      this.emit({ type: 'turn', hand: hand.key });
      return;
    }
    this.playDealer();
  }

  /** The actions the active hand may take. */
  availableActions(): AvailableActions {
    if (this.state === STATE.insurance) {
      return { surrender: this.earlySurrenderOffered() };
    }
    const hand = this.activeHand;
    if (this.state !== STATE.playerAction || !hand || hand.owner !== PLAYER.human) return {};
    const mayDraw = splitAcesMayDraw(this.rules, hand) && !hand.busted();
    return {
      hit: mayDraw && splitAcesMayHit(this.rules, hand) && (!hand.doubled || this.rules.hitAfterDouble),
      stand: true,
      double: mayDraw && doubleAllowed(this.rules, hand) && this.bankroll >= this.doubleCost(hand),
      split: splitAllowed(this.rules, hand, this.handsInSeat(hand.seat)) && this.bankroll >= hand.bet,
      surrender: this.surrenderAvailable(hand),
    };
  }

  /** Whether the hand waiting on the insurance offer may give up now. */
  earlySurrenderOffered(): boolean {
    const hand = this.humanHands()[0];
    if (!hand || hand.surrendered) return false;
    if (!surrenderAllowed(this.rules, hand, { hasInsurance: hand.insuranceBet > 0 })) return false;
    return earlySurrenderAllowed(this.rules, this.dealer.cards[0]);
  }

  surrenderAvailable(hand: Hand): boolean {
    if (!surrenderAllowed(this.rules, hand, { hasInsurance: hand.insuranceBet > 0 })) return false;
    if (hand.doubled) return this.rules.doubleDownRescue;
    // Early surrender is decided before the dealer checks the hole card.
    if (!this.insuranceDecided) return earlySurrenderAllowed(this.rules, this.dealer.cards[0]);
    return true;
  }

  /** Performs an action for the active hand. */
  act(action: GameAction): GameEvent[] {
    if (this.state === STATE.insurance) {
      // Only an early surrender is taken here; the insurance offer stays up.
      if (action === ACTION.surrender && this.earlySurrenderOffered()) {
        const giving = this.humanHands()[0];
        giving.surrendered = true;
        this.emit({ type: 'message', text: RESULT.surrender, hand: giving.key });
      }
      return this.takeEvents();
    }
    const hand = this.activeHand;
    if (this.state !== STATE.playerAction || !hand) return this.takeEvents();
    if (!this.availableActions()[action]) return this.takeEvents();
    this.emit({ type: 'action', hand: hand.key, action });
    switch (action) {
      case ACTION.hit:
        this.hit(hand);
        break;
      case ACTION.stand:
        this.stand(hand);
        break;
      case ACTION.double:
        this.double(hand);
        break;
      case ACTION.split:
        if (this.split(hand)) this.emit({ type: 'turn', hand: hand.key });
        else this.advance();
        break;
      case ACTION.surrender:
        this.surrender(hand);
        break;
      default:
        break;
    }
    return this.takeEvents();
  }

  hit(hand: Hand): void {
    this.dealTo(hand);
    if (hand.busted()) {
      this.emit({ type: 'message', text: RESULT.bust, hand: hand.key });
      this.advance();
      return;
    }
    if (this.callsGoodHandBust(hand)) return;
    if (this.autoStands(hand)) {
      this.stand(hand);
      return;
    }
    this.emit({ type: 'turn', hand: hand.key });
  }

  /**
   * The dealer may wrongly call a good hand a bust the moment a card lands on
   * it, the double card included, as the original checked in its HitIt.
   * True when it did, and play has moved on.
   */
  callsGoodHandBust(hand: Hand): boolean {
    if (hand.owner !== PLAYER.human || !this.onGoodHandBusted?.(hand)) return false;
    hand.mistakenBust = true;
    hand.stood = true;
    this.emit({ type: 'message', text: RESULT.bust, hand: hand.key });
    this.advance();
    return true;
  }

  /**
   * Whether the dealer takes the decision away. As in the original: a 21, a card
   * count that already wins, the hand limit, or an obvious play.
   */
  autoStands(hand: Hand): boolean {
    const { total, hardTotal } = hand.totals();
    // A 21 stands, except a soft 21 on exactly four cards, which may chase a bonus.
    // `totals()` reports a 22 that counts as 21 as 21, so compare against 21 itself.
    if (total === 21 && (hardTotal === total || hand.cardCount !== 4)) return true;
    if (charlieWin(this.rules, hand)) return true;
    if (hand.cardCount >= (this.table.maxCardsPerHand ?? MAX_CARDS_PER_HAND)) return true;
    return this.obviousStand(hand);
  }

  /** "Dealer makes obvious plays": the dealer stands a hand that cannot want a card. */
  obviousStand(hand: Hand): boolean {
    if (!this.table.dealerMakesObviousPlays || this.table.cardsFaceDown) return false;
    const { total, hardTotal } = hand.totals();
    if (hardTotal > 19) return true;
    // A hard 17 or better, but a pair of nines is left alone.
    const nines = hand.cardCount === 2 && hand.values.every(v => v === 9);
    return total === hardTotal && hardTotal > 16 && !nines;
  }

  stand(hand: Hand): void {
    hand.stood = true;
    if (this.table.cardsFaceDown && !hand.doubled && !hand.isSplit) this.concealHand(hand);
    this.advance();
  }

  /** Turns a whole hand face up (its turn, or the showdown). */
  revealHand(hand: Hand): void {
    for (const index of hand.faceUp.keys()) this.reveal(hand, index);
  }

  /** Puts a hand back face down. */
  concealHand(hand: Hand): void {
    hand.faceUp.forEach((up, index) => {
      if (!up) return;
      hand.faceUp[index] = false;
      this.emit({ type: 'conceal', hand: hand.key, cardIndex: index });
    });
  }

  /** What doubling this hand would stake: the bet plus the doubles already made. */
  doubleCost(hand: Hand): number {
    return (hand.bet + hand.doubleBet) * (this.rules.tripleDown ? 2 : 1);
  }

  double(hand: Hand): void {
    const extra = this.doubleCost(hand);
    hand.doubleBet += extra;
    this.bankroll -= extra;
    hand.doubled = true;
    this.emit({ type: 'double', hand: hand.key, amount: extra });
    // A doubled hand takes exactly one card, unless the table lets it draw on.
    this.dealTo(hand, { faceUp: this.table.doubleDownCardFaceUp });
    if (hand.busted()) {
      this.advance();
      return;
    }
    if (this.callsGoodHandBust(hand)) return;
    // A redoubled hand is finished unless the table doubles on any number of cards.
    const redoubled = hand.doubleBet > hand.bet && !this.rules.doubleAnyNumberOfCards;
    const mayContinue =
      (this.rules.hitAfterDouble || this.rules.redouble || this.rules.doubleDownRescue) &&
      hand.total <= 20 &&
      !redoubled;
    if (mayContinue) {
      this.emit({ type: 'turn', hand: hand.key });
      return;
    }
    this.stand(hand);
  }

  /** Splits a hand, returning false when the hand it leaves behind may not play on. */
  split(hand: Hand): boolean {
    // A split hand is a pair, so there is a card to move.
    const moved = hand.cards.pop()!;
    const movedFaceUp = hand.faceUp.pop();
    // The card's counted mark goes with it, or the card drawn into its place is skipped.
    // Marks are by position and may be missing for unseen cards, so not pop().
    const movedCounted = hand.counted[hand.cards.length];
    hand.counted.length = Math.min(hand.counted.length, hand.cards.length);
    const splitCount = hand.splitCount + 1;
    hand.splitCount = splitCount;

    const newHand = new Hand({ seat: hand.seat, index: this.handsInSeat(hand.seat), owner: hand.owner, bet: hand.bet });
    newHand.bustCeiling = hand.bustCeiling;
    newHand.splitCount = splitCount;
    newHand.splitFrom = hand.key;
    newHand.addCard(moved, movedFaceUp);
    newHand.counted[0] = movedCounted ?? false;
    if (hand.owner === PLAYER.human) this.bankroll -= newHand.bet;
    // Keep the new hand next to its sibling so play order follows the table.
    this.hands.splice(this.activeIndex + 1, 0, newHand);
    // Every hand in this seat shares the split count, so resplit limits apply.
    this.hands
      .filter(h => h.seat === hand.seat)
      .forEach(h => {
        h.splitCount = splitCount;
      });
    this.emit({ type: 'split', hand: hand.key, newHand: newHand.key, card: moved });

    this.dealTo(hand, { faceUp: this.dealtFaceUp(hand) });
    if (hand.owner === PLAYER.human) this.revealHand(hand);
    if (!splitAcesMayDraw(this.rules, hand)) {
      hand.stood = true;
      return false;
    }
    return true;
  }

  surrender(hand: Hand): void {
    hand.surrendered = true;
    this.emit({ type: 'message', text: RESULT.surrender, hand: hand.key });
    this.advance();
  }

  /** Plays a computer seat with the supplied decision function. */
  playComputerHand(hand: Hand): void {
    for (let i = 0; i < COMPUTER_DECISION_LIMIT; i++) {
      if (hand.isNatural() || hand.busted() || hand.stood) break;
      const action =
        this.computerPlay?.(hand, { dealerUpcard: this.dealer.cards[0], game: this }) ??
        defaultComputerAction(this.rules, hand, this.dealer.cards[0]);
      if (action === ACTION.double && doubleAllowed(this.rules, hand)) {
        hand.doubleBet += hand.bet;
        hand.doubled = true;
        this.dealTo(hand, { faceUp: this.table.doubleDownCardFaceUp });
        break;
      }
      if (action === ACTION.split && splitAllowed(this.rules, hand, this.handsInSeat(hand.seat))) {
        if (!this.split(hand)) break;
        continue;
      }
      if (action === ACTION.hit) {
        this.dealTo(hand);
        if (!hand.busted() && this.autoStands(hand)) {
          hand.stood = true;
          break;
        }
        continue;
      }
      hand.stood = true;
      break;
    }
    if (hand.busted()) {
      // A busted hand is turned up before it is swept, as the original did.
      this.revealHand(hand);
      this.emit({ type: 'message', text: RESULT.bust, hand: hand.key });
    }
  }

  /** The dealer draws, then the round is settled. */
  playDealer(): void {
    this.state = STATE.dealer;
    this.emit({ type: 'dealerTurn' });
    const live = this.hands.some(h => !h.surrendered && !h.busted() && !h.mistakenBust && !h.isNatural());
    if (this.rules.noHoleCard && this.dealer.cardCount === 1 && live) this.dealTo(this.dealer, { faceUp: true });
    if (this.dealer.cardCount > 1) this.reveal(this.dealer, 1);

    if (live && !this.dealerBlackjack && this.dealer.cardCount === 2 && this.dealer.total === 21) {
      this.dealerBlackjack = true;
      this.emit({ type: 'message', text: 'Dealer has Blackjack' });
    } else if (live) {
      while (dealerShouldDraw(this.rules, this.dealer)) {
        if (this.beforeDealerDraw && this.beforeDealerDraw(this.dealer) === false) break;
        this.dealTo(this.dealer, { faceUp: true });
      }
    }
    this.finishRound();
  }

  /** Settles every hand and returns the chips to the bankroll. */
  finishRound(): void {
    // Every card still face down is turned up at the showdown, before it is paid:
    // a face-down game's hands, and a double card dealt face down in any game.
    for (const hand of this.hands) this.revealHand(hand);
    for (const hand of this.hands) {
      const { payout, result, net } = settleHand({
        rules: this.rules,
        hand,
        dealer: this.dealer,
        dealerBlackjack: this.dealerBlackjack,
      });
      const side = this.settleSideBets(hand, result);
      hand.result = result;
      hand.payout = payout + side.payout;
      if (hand.owner === PLAYER.human) this.bankroll += hand.payout;
      this.emit({
        type: 'settled',
        hand: hand.key,
        result,
        payout: hand.payout,
        net: net + side.net,
        seat: hand.seat,
        owner: hand.owner,
        sideBets: side.details,
      });
    }
    this.shoe.endRound();
    this.state = STATE.settled;
    this.emit({ type: 'roundEnd', bankroll: this.bankroll, needsShuffle: this.shoe.needsShuffle });
  }

  /** Settles a hand's side bets and any bonus the game pays on the main bet. */
  settleSideBets(hand: Hand, result: Result): { payout: number; net: number; details: SideBetDetail[] } {
    const game = this.sideBetGame;
    const stakes = Object.entries(hand.sideBets).filter(([, amount]) => amount > 0);
    const bonusEligible = game && hand.cardCount > 0;
    if (stakes.length === 0 && !bonusEligible) return { payout: 0, net: 0, details: [] };

    const context = {
      playerHandCards: hand.cards,
      dealerHandCards: this.dealer.cards,
      won: result === RESULT.win || result === RESULT.blackjack || result === RESULT.bonus,
      doubled: hand.doubled,
      split: hand.isSplit,
      trueCount: this.trueCount(),
      playerTotal: hand.total,
      dealerTotal: this.dealer.total,
      dealerBlackjack: this.dealerBlackjack,
    };
    const spots = sideBetSpots(game);
    let payout = 0;
    let staked = 0;
    const details: SideBetDetail[] = [];
    stakes.forEach(([name, stake], index) => {
      staked += stake;
      const spot = spots.find(s => s.id === name) ?? spots[index] ?? spots[0];
      // A game always has a spot, so `game` is set whenever `spot` is.
      if (!spot || !game) return;
      const won = evaluateSideBet({ game, ruleIndex: spot.ruleIndex, stake, context });
      payout += won?.payout ?? 0;
      details.push({ name, stake, payout: won?.payout ?? 0, multiplier: won?.multiplier ?? -1, label: spot.id });
    });

    // Some games add a bonus to the main bet rather than to a side bet.
    if (bonusEligible) {
      const bonus = evaluateHandBonus({ game, bet: hand.bet, context });
      if (bonus) {
        payout += bonus.payout;
        details.push({ name: 'bonus', stake: 0, payout: bonus.payout, multiplier: bonus.multiplier, label: 'Bonus' });
      }
    }
    return { payout, net: payout - staked, details };
  }

  /** Clears the table, ready for the next round's bets. */
  nextRound(): GameEvent[] {
    this.state = STATE.betting;
    this.hands = [];
    this.dealer = new Hand({ seat: DEALER_SEAT });
    this.emit({ type: 'clear' });
    if (this.shoe.needsShuffle) this.shuffleAndBurn();
    return this.takeEvents();
  }
}

/** A simple dealer-like strategy for computer seats, used when none is supplied. */
export function defaultComputerAction(rules: Rules, hand: Hand, dealerUpcard: CardId): GameAction {
  const { total, hardTotal } = hand.totals();
  if (total >= 17) return ACTION.stand;
  if (hardTotal >= 12 && valueOf(dealerUpcard) >= 2 && valueOf(dealerUpcard) <= 6) return ACTION.stand;
  return ACTION.hit;
}
