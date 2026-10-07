// @ts-nocheck
// The shoe: cards still available, drawn in random order, with the cut card
// and shuffle rules.

import { CARDS_PER_DECK } from '../../core/cards.ts';
import { defaultRandom } from '../../core/random.ts';

export const SHUFFLE_MODE = { cutCard: 'cutCard', rounds: 'rounds' };

export class Shoe {
  /**
   * @param {object} o
   * @param {number} o.decks
   * @param {string} o.shuffleMode       A SHUFFLE_MODE: shuffle when the cut card appears, or after a fixed number of rounds.
   * @param {number} o.cardsBehindCutCard
   * @param {number} o.roundsPerShoe
   * @param {() => number} [o.random]
   */
  constructor({
    decks,
    shuffleMode = SHUFFLE_MODE.cutCard,
    cardsBehindCutCard = 78,
    roundsPerShoe = 6,
    random = defaultRandom,
  }) {
    this.decks = decks;
    this.shuffleMode = shuffleMode;
    this.cardsBehindCutCard = cardsBehindCutCard;
    this.roundsPerShoe = roundsPerShoe;
    this.random = random;
    this.shuffle();
  }

  get totalCards() {
    return this.decks * CARDS_PER_DECK;
  }

  /** Cards that may be dealt before the cut card shows. */
  get penetration() {
    return this.shuffleMode === SHUFFLE_MODE.rounds ? Infinity : this.totalCards - this.cardsBehindCutCard;
  }

  shuffle() {
    /** How many of each card id (1..52) remain. */
    this.remainingByCard = new Array(CARDS_PER_DECK + 1).fill(this.decks);
    this.remainingByCard[0] = 0;
    this.remaining = this.totalCards;
    this.dealt = 0;
    this.roundsDealt = 0;
    this.cutCardSeen = false;
    this.needsShuffle = false;
  }

  /** Draws a uniformly random remaining card, or null when the shoe is empty. */
  draw() {
    if (this.remaining === 0) return null;
    let pick = Math.floor(this.random() * this.remaining);
    for (let card = 1; card <= CARDS_PER_DECK; card++) {
      pick -= this.remainingByCard[card];
      if (pick < 0) {
        // The original tested penetration before dealing, so the card after it trips the cut card.
        if (!this.cutCardSeen && this.dealt >= this.penetration) {
          this.cutCardSeen = true;
          this.needsShuffle = true;
        }
        this.remainingByCard[card] -= 1;
        this.remaining -= 1;
        this.dealt += 1;
        return card;
      }
    }
    return null;
  }

  /** Puts a card back (used when a bias rejects a drawn card). */
  putBack(card) {
    this.remainingByCard[card] += 1;
    this.remaining += 1;
    this.dealt -= 1;
  }

  /** Called at the end of each round; sets `needsShuffle` when the shoe is done. */
  endRound() {
    this.roundsDealt += 1;
    if (this.shuffleMode === SHUFFLE_MODE.rounds && this.roundsDealt >= this.roundsPerShoe) this.needsShuffle = true;
    if (this.remaining === 0) this.needsShuffle = true;
  }

  /** Decks sitting in the discard tray. */
  get decksInTray() {
    return this.dealt / CARDS_PER_DECK;
  }
}
