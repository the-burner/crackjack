// The blackjack round, as a state machine with no DOM involvement.
//
// The screen drives it: start a round, read `events` to animate what happened,
// and when `state` is 'playerAction' offer `availableActions()` and call
// `act()`. Everything the UI needs is on the engine's state; the engine never
// waits, so animation speed is entirely the screen's business.

import { valueOf } from '../../core/cards.js';
import { defaultRandom } from '../../core/random.js';
import { Hand, PLAYER } from './hand.js';
import { Shoe } from './shoe.js';
import {
  dealerPeeks, insuranceOffered, doubleAllowed, splitAllowed, splitAcesMayDraw,
  surrenderAllowed, earlySurrenderAllowed, dealerShouldDraw, bustValue,
} from './rules.js';
import { settleHand, RESULT } from './settlement.js';

export const STATE = {
  betting: 'betting',
  dealing: 'dealing',
  insurance: 'insurance',
  playerAction: 'playerAction',
  dealer: 'dealer',
  settled: 'settled',
};

export const ACTION = { hit: 'hit', stand: 'stand', double: 'double', split: 'split', surrender: 'surrender' };

/** The dealer's seat number. */
const DEALER_SEAT = 0;

export class BlackjackGame {
  /**
   * @param {object} o
   * @param {object} o.rules                From rulesFrom(settings).
   * @param {object} o.table                {decks, shuffleMode, cardsBehindCutCard, roundsPerShoe, burnCards, seatCount, computerSeats, limits}
   * @param {number} o.bankroll
   * @param {() => number} [o.random]
   * @param {(hand: Hand, context: object) => string} [o.computerPlay]  Decides a computer player's action.
   * @param {(card: number, faceUp: boolean) => void} [o.onCardSeen]    Called for counting.
   */
  constructor({ rules, table, bankroll, random = defaultRandom, computerPlay = null, onCardSeen = null }) {
    this.rules = rules;
    this.table = table;
    this.bankroll = bankroll;
    this.random = random;
    this.computerPlay = computerPlay;
    this.onCardSeen = onCardSeen;
    this.shoe = new Shoe({ ...table, random });
    this.state = STATE.betting;
    this.events = [];
    this.hands = [];
    this.dealer = new Hand({ seat: DEALER_SEAT });
    this.roundNumber = 0;
    this.shuffleAndBurn();
  }

  // --- events ---------------------------------------------------------------

  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }

  /** Takes the events recorded since the last call. */
  takeEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  // --- shoe -----------------------------------------------------------------

  shuffleAndBurn() {
    this.shoe.shuffle();
    this.emit('shuffle');
    for (let i = 0; i < (this.table.burnCards ?? 0); i++) {
      const card = this.shoe.draw();
      this.emit('burn', { card });
    }
  }

  /** Deals one card to a hand, counting it when it is face up. */
  dealTo(hand, { faceUp = true } = {}) {
    if (this.shoe.remaining === 0) this.shuffleAndBurn();
    const card = this.shoe.draw();
    hand.addCard(card, faceUp);
    this.emit('card', { hand: hand.key, card, faceUp, cardIndex: hand.cardCount - 1 });
    if (faceUp) this.onCardSeen?.(card, true);
    return card;
  }

  /** Turns a face-down card face up, counting it. */
  reveal(hand, index) {
    if (hand.faceUp[index]) return;
    hand.faceUp[index] = true;
    this.emit('reveal', { hand: hand.key, cardIndex: index, card: hand.cards[index] });
    this.onCardSeen?.(hand.cards[index], true);
  }

  // --- round ----------------------------------------------------------------

  /**
   * Starts a round.
   * @param {{seat: number, bet: number, sideBets?: object}[]} bets  Bets for the human seats.
   */
  startRound(bets) {
    if (this.shoe.needsShuffle) this.shuffleAndBurn();
    this.roundNumber += 1;
    this.dealer = new Hand({ seat: DEALER_SEAT });
    this.hands = [];
    this.dealerBlackjack = false;
    this.insuranceDecided = false;
    this.activeIndex = -1;

    for (const { seat, bet, sideBets = {} } of bets) {
      if (bet <= 0) continue;
      const hand = new Hand({ seat, owner: PLAYER.human, bet });
      hand.sideBets = { ...sideBets };
      this.hands.push(hand);
      this.bankroll -= hand.wagered;
    }
    for (const seat of this.table.computerSeats ?? []) {
      if (seat > (this.table.seatCount ?? 0)) continue;
      this.hands.push(new Hand({ seat, owner: PLAYER.computer, bet: this.table.computerBet ?? 5 }));
    }
    this.hands.sort((a, b) => a.seat - b.seat || a.index - b.index);

    this.state = STATE.dealing;
    this.emit('roundStart', { round: this.roundNumber });
    this.deal();
    return this.takeEvents();
  }

  deal() {
    const playerFaceUp = !this.table.cardsFaceDown;
    for (let pass = 0; pass < 2; pass++) {
      for (const hand of this.hands) this.dealTo(hand, { faceUp: playerFaceUp });
      if (pass === 0) this.dealTo(this.dealer, { faceUp: true });
      else if (!this.rules.noHoleCard) this.dealTo(this.dealer, { faceUp: false });
    }
    this.emit('dealt', { upcard: this.dealer.cards[0] });

    const playerHasTwentyOne = this.humanHands().some(h => h.total === 21);
    if (insuranceOffered(this.rules, this.dealer.cards[0], playerHasTwentyOne)) {
      this.state = STATE.insurance;
      this.emit('offerInsurance');
      return;
    }
    this.afterInsurance();
  }

  /** Takes insurance on every human hand that has a bet. */
  takeInsurance() {
    if (this.state !== STATE.insurance) return this.takeEvents();
    for (const hand of this.humanHands()) {
      hand.insuranceBet = hand.bet / 2;
      this.bankroll -= hand.insuranceBet;
    }
    this.emit('insuranceTaken');
    this.afterInsurance();
    return this.takeEvents();
  }

  declineInsurance() {
    if (this.state !== STATE.insurance) return this.takeEvents();
    this.emit('insuranceDeclined');
    this.afterInsurance();
    return this.takeEvents();
  }

  afterInsurance() {
    this.insuranceDecided = true;
    // The dealer checks the hole card where the rules say so.
    if (dealerPeeks(this.rules, this.dealer.cards[0])) {
      if (this.dealer.total === 21) {
        this.dealerBlackjack = true;
        this.reveal(this.dealer, 1);
        this.emit('message', { text: 'Dealer has Blackjack' });
        this.finishRound();
        return;
      }
      this.emit('message', { text: 'No Dealer Blackjack' });
    }
    this.state = STATE.playerAction;
    this.advance();
  }

  humanHands() {
    return this.hands.filter(h => h.owner === PLAYER.human);
  }

  handsInSeat(seat) {
    return this.hands.filter(h => h.seat === seat).length;
  }

  get activeHand() {
    return this.hands[this.activeIndex] ?? null;
  }

  /** Moves to the next hand that needs attention, then plays out the dealer. */
  advance() {
    for (let i = this.activeIndex + 1; i < this.hands.length; i++) {
      const hand = this.hands[i];
      this.activeIndex = i;
      // A split hand still needs its second card.
      if (hand.cardCount === 1) this.dealTo(hand, { faceUp: !this.table.cardsFaceDown });
      for (const index of hand.faceUp.keys()) this.reveal(hand, index);

      if (hand.isNatural()) {
        this.emit('message', { text: 'Blackjack', hand: hand.key });
        continue;
      }
      if (!splitAcesMayDraw(this.rules, hand)) {
        hand.stood = true;
        continue;
      }
      if (hand.owner === PLAYER.computer) {
        this.playComputerHand(hand);
        continue;
      }
      if (hand.busted() || hand.stood) continue;
      this.emit('turn', { hand: hand.key });
      return;
    }
    this.playDealer();
  }

  /** The actions the active hand may take. */
  availableActions() {
    const hand = this.activeHand;
    if (this.state !== STATE.playerAction || !hand || hand.owner !== PLAYER.human) return {};
    const mayDraw = splitAcesMayDraw(this.rules, hand) && !hand.busted();
    const canHitAfterDouble = hand.doubled && (this.rules.hitAfterDouble || this.rules.redouble);
    return {
      hit: mayDraw && (!hand.doubled || canHitAfterDouble),
      stand: true,
      double: mayDraw && doubleAllowed(this.rules, hand) && this.bankroll >= hand.bet,
      split: splitAllowed(this.rules, hand, this.handsInSeat(hand.seat)) && this.bankroll >= hand.bet,
      surrender: this.surrenderAvailable(hand),
    };
  }

  surrenderAvailable(hand) {
    if (!surrenderAllowed(this.rules, hand, { hasInsurance: hand.insuranceBet > 0 })) return false;
    if (hand.doubled) return this.rules.doubleDownRescue;
    // Early surrender is decided before the dealer checks the hole card.
    if (!this.insuranceDecided) return earlySurrenderAllowed(this.rules, this.dealer.cards[0]);
    return true;
  }

  /** Performs an action for the active hand. */
  act(action) {
    const hand = this.activeHand;
    if (this.state !== STATE.playerAction || !hand) return this.takeEvents();
    if (!this.availableActions()[action]) return this.takeEvents();
    this.emit('action', { hand: hand.key, action });
    switch (action) {
      case ACTION.hit: this.hit(hand); break;
      case ACTION.stand: this.stand(hand); break;
      case ACTION.double: this.double(hand); break;
      case ACTION.split: this.split(hand); break;
      case ACTION.surrender: this.surrender(hand); break;
      default: break;
    }
    return this.takeEvents();
  }

  hit(hand) {
    this.dealTo(hand);
    if (hand.busted(bustValue())) {
      this.emit('message', { text: RESULT.bust, hand: hand.key });
      this.advance();
      return;
    }
    if (hand.total === 21 || hand.cardCount >= (this.table.maxCardsPerHand ?? 7)) {
      this.stand(hand);
      return;
    }
    this.emit('turn', { hand: hand.key });
  }

  stand(hand) {
    hand.stood = true;
    this.advance();
  }

  double(hand) {
    const extra = this.rules.tripleDown ? hand.bet * 2 : hand.bet;
    hand.doubleBet += extra;
    this.bankroll -= extra;
    hand.doubled = true;
    this.emit('double', { hand: hand.key, amount: extra });
    // A doubled hand takes exactly one card, unless the table lets it draw on.
    this.dealTo(hand, { faceUp: this.table.doubleDownCardFaceUp });
    if (!this.table.doubleDownCardFaceUp) this.reveal(hand, hand.cardCount - 1);
    if (hand.busted()) {
      this.emit('message', { text: RESULT.bust, hand: hand.key });
      this.advance();
      return;
    }
    const mayContinue = (this.rules.hitAfterDouble || this.rules.redouble || this.rules.doubleDownRescue) && hand.total <= 20;
    if (mayContinue) {
      this.emit('turn', { hand: hand.key });
      return;
    }
    this.stand(hand);
  }

  split(hand) {
    const moved = hand.cards.pop();
    const movedFaceUp = hand.faceUp.pop();
    const splitCount = hand.splitCount + 1;
    hand.splitCount = splitCount;

    const newHand = new Hand({ seat: hand.seat, index: this.handsInSeat(hand.seat), owner: hand.owner, bet: hand.bet });
    newHand.splitCount = splitCount;
    newHand.splitFrom = hand.key;
    newHand.addCard(moved, movedFaceUp);
    if (hand.owner === PLAYER.human) this.bankroll -= newHand.bet;
    // Keep the new hand next to its sibling so play order follows the table.
    this.hands.splice(this.activeIndex + 1, 0, newHand);
    // Every hand in this seat shares the split count, so resplit limits apply.
    this.hands.filter(h => h.seat === hand.seat).forEach(h => { h.splitCount = splitCount; });
    this.emit('split', { hand: hand.key, newHand: newHand.key, card: moved });

    this.dealTo(hand, { faceUp: !this.table.cardsFaceDown });
    for (const index of hand.faceUp.keys()) this.reveal(hand, index);
    if (!splitAcesMayDraw(this.rules, hand)) {
      hand.stood = true;
      this.advance();
      return;
    }
    this.emit('turn', { hand: hand.key });
  }

  surrender(hand) {
    hand.surrendered = true;
    this.emit('message', { text: RESULT.surrender, hand: hand.key });
    this.advance();
  }

  /** Plays a computer seat with the supplied decision function. */
  playComputerHand(hand) {
    const guard = 12;
    for (let i = 0; i < guard; i++) {
      if (hand.isNatural() || hand.busted() || hand.stood) break;
      const action = this.computerPlay?.(hand, { dealerUpcard: this.dealer.cards[0], game: this }) ?? defaultComputerAction(this.rules, hand, this.dealer.cards[0]);
      if (action === ACTION.double && doubleAllowed(this.rules, hand)) {
        hand.doubleBet += hand.bet;
        hand.doubled = true;
        this.dealTo(hand, { faceUp: this.table.doubleDownCardFaceUp });
        break;
      }
      if (action === ACTION.split && splitAllowed(this.rules, hand, this.handsInSeat(hand.seat))) {
        this.split(hand);
        return;
      }
      if (action === ACTION.hit) {
        this.dealTo(hand);
        continue;
      }
      hand.stood = true;
      break;
    }
  }

  /** The dealer draws, then the round is settled. */
  playDealer() {
    this.state = STATE.dealer;
    this.emit('dealerTurn');
    const live = this.hands.some(h => !h.surrendered && !h.busted() && !h.isNatural());
    if (this.rules.noHoleCard && this.dealer.cardCount === 1 && live) this.dealTo(this.dealer, { faceUp: true });
    if (this.dealer.cardCount > 1) this.reveal(this.dealer, 1);

    if (!this.dealerBlackjack && this.dealer.cardCount === 2 && this.dealer.total === 21) {
      this.dealerBlackjack = true;
      this.emit('message', { text: 'Dealer has Blackjack' });
    } else if (live) {
      while (dealerShouldDraw(this.rules, this.dealer)) this.dealTo(this.dealer, { faceUp: true });
      if (this.dealer.busted()) this.emit('message', { text: 'Dealer busts' });
    }
    this.finishRound();
  }

  /** Settles every hand and returns the chips to the bankroll. */
  finishRound() {
    for (const hand of this.hands) {
      const { payout, result, net } = settleHand({ rules: this.rules, hand, dealer: this.dealer, dealerBlackjack: this.dealerBlackjack });
      hand.result = result;
      hand.payout = payout;
      if (hand.owner === PLAYER.human) this.bankroll += payout;
      this.emit('settled', { hand: hand.key, result, payout, net, seat: hand.seat, owner: hand.owner });
    }
    this.shoe.endRound();
    this.state = STATE.settled;
    this.emit('roundEnd', { bankroll: this.bankroll, needsShuffle: this.shoe.needsShuffle });
  }

  /** Clears the table, ready for the next round's bets. */
  nextRound() {
    this.state = STATE.betting;
    this.hands = [];
    this.dealer = new Hand({ seat: DEALER_SEAT });
    this.emit('clear');
    return this.takeEvents();
  }
}

/** A simple dealer-like strategy for computer seats, used when none is supplied. */
export function defaultComputerAction(rules, hand, dealerUpcard) {
  const { total, hardTotal } = hand.totals();
  if (total >= 17) return ACTION.stand;
  if (hardTotal >= 12 && valueOf(dealerUpcard) >= 2 && valueOf(dealerUpcard) <= 6) return ACTION.stand;
  return ACTION.hit;
}
