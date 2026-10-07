// @ts-nocheck
// A shoe of cards for the counting drills: shuffled card ids dealt in order,
// with the running count kept by a Counter.

import { CARDS_PER_DECK } from '../../core/cards.ts';
import { shuffle as shuffleArray, defaultRandom } from '../../core/random.ts';
import { Counter } from '../../core/counting.ts';

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

  /**
   * Deals the next card and also reports how much it moved the running count,
   * which the Two Tables drill needs to count cards as they are revealed.
   * @returns {{card: number, countValue: number}|null}
   */
  dealWithCountValue() {
    const before = this.counter.running;
    const card = this.deal();
    return card === null ? null : { card, countValue: this.counter.running - before };
  }

  /**
   * Biases the next card the way the Count and Full drills do: while more than
   * half the shoe is left, a card whose count value has the unwanted sign is
   * pushed back most of the time.
   * @param {'none'|'negative'|'positive'} bias
   */
  biasNext(bias) {
    if (bias === 'none' || this.remaining * 2 <= this.cards.length) return;
    const values = this.counter.strategy.countValues;
    const rank = Math.min(((this.cards[this.dealt] - 1) % 13) + 1, 10);
    const unwanted = bias === 'negative' ? 1 : -1;
    const chance = bias === 'negative' ? 0.67 : 0.71;
    if (Math.sign(values[rank]) === unwanted && this.random() < chance) this.applyBias(bias);
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
