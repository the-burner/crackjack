// A shoe of cards for the counting drills: shuffled card ids dealt in order,
// with the running count kept by a Counter.

import { CARDS_PER_DECK } from '../../core/cards.js';
import { shuffle as shuffleArray, defaultRandom } from '../../core/random.js';
import { Counter } from '../../core/counting.js';

export class DrillShoe {
  /**
   * @param {object} o
   * @param {number} o.decks
   * @param {object} o.strategy            Built strategy (for count values and the initial count).
   * @param {object} o.trueCountSettings   {division, lastDeck, rounding, aceSideCount}
   * @param {() => number} [o.random]
   * @param {number} [o.cardsPerDeck]      48 for Spanish decks (no tens).
   */
  constructor({ decks, strategy, trueCountSettings, random = defaultRandom, cardsPerDeck = CARDS_PER_DECK }) {
    this.decks = decks;
    this.cardsPerDeck = cardsPerDeck;
    this.random = random;
    this.counter = new Counter(strategy, trueCountSettings);
    this.counter.cardsPerDeck = cardsPerDeck;
    this.shuffle();
  }

  shuffle() {
    const cards = [];
    for (let deck = 0; deck < this.decks; deck++) {
      for (let id = 1; id <= CARDS_PER_DECK; id++) {
        // Spanish decks have no tens.
        if (this.cardsPerDeck === 48 && id % 13 === 10) continue;
        cards.push(id);
      }
    }
    this.cards = shuffleArray(cards, this.random);
    this.dealt = 0;
    this.counter.reset(this.decks, { cardsPerDeck: this.cardsPerDeck });
  }

  get remaining() {
    return this.cards.length - this.dealt;
  }

  /** Deals the next card and counts it. */
  deal() {
    if (this.remaining === 0) return null;
    const card = this.cards[this.dealt];
    this.dealt += 1;
    this.counter.addCard(card, this.dealt);
    return card;
  }

  /**
   * Reorders the cards still to come so the next card's count value has the
   * wanted sign, which is how the drills bias a shoe.
   * @param {'none'|'negative'|'positive'} bias
   */
  applyBias(bias) {
    if (bias === 'none') return;
    const wanted = bias === 'positive' ? 1 : -1;
    const values = this.counter.strategy.countValues;
    for (let i = this.dealt; i < this.cards.length; i++) {
      const rank = Math.min(((this.cards[i] - 1) % 13) + 1, 10);
      if (Math.sign(values[rank]) === wanted) {
        [this.cards[this.dealt], this.cards[i]] = [this.cards[i], this.cards[this.dealt]];
        return;
      }
    }
  }

  /** Decks still in the shoe, by the true-count settings. */
  decksRemaining() {
    return this.counter.decksRemaining(this.dealt);
  }

  /** Decks sitting in the discard tray. */
  decksInTray() {
    return this.decks - this.remaining / this.cardsPerDeck;
  }
}
