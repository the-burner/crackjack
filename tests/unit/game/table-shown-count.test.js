import { describe, it, expect } from 'vitest';
import { createShownCount } from '../../../src/game/table/shown-count.ts';
import { chipText } from '../../../src/game/table/labels.ts';
import { sideBetLabel } from '../../../src/game/table/side-bet-picker.ts';
import { GameSession } from '../../../src/game/session.ts';
import { createServices } from '../../../src/app/app.ts';
import { MemoryBackend } from '../../../src/services/storage.ts';
import { Counter } from '../../../src/core/counting.ts';
import { cardId } from '../../../src/core/cards.ts';

const card = rank => cardId(rank, 0);

function counts() {
  const app = createServices({ backend: new MemoryBackend() });
  const session = new GameSession(app);
  const options = { strategy: session.strategy, settings: session.trueCountSettings(), decks: session.table.decks };
  /** What the cards are worth counted directly, one each. */
  const direct = (...cards) => {
    const counter = new Counter(options.strategy, options.settings);
    counter.reset(options.decks);
    cards.forEach((c, i) => counter.addCard(c, i + 1));
    return counter.running;
  };
  return { shown: createShownCount(options), direct };
}

describe('the count as the player has seen it', () => {
  it('counts face-up cards, burns and reveals, not face-down ones', () => {
    const { shown, direct } = counts();
    shown.see({ type: 'burn', card: card(2), faceUp: true }, 1);
    shown.see({ type: 'card', hand: '1-0', card: card(5), faceUp: true, cardIndex: 0 }, 2);
    shown.see({ type: 'card', hand: '0-0', card: card(10), faceUp: false, cardIndex: 1 }, 3);
    expect(shown.running).toBe(direct(card(2), card(5)));
    shown.see({ type: 'reveal', hand: '0-0', card: card(10), cardIndex: 1 }, 3);
    expect(shown.running).toBe(direct(card(2), card(5), card(10)));
  });

  it('counts a flashed hole card once', () => {
    const { shown, direct } = counts();
    shown.see({ type: 'card', hand: '0-0', card: card(10), faceUp: false, cardIndex: 1 }, 1);
    shown.see({ type: 'peek', hand: '0-0', card: card(10), cardIndex: 1 }, 1);
    shown.see({ type: 'reveal', hand: '0-0', card: card(10), cardIndex: 1 }, 1);
    expect(shown.running).toBe(direct(card(10)));
  });

  it('keeps a split card counted when it moves to its new hand', () => {
    const { shown, direct } = counts();
    shown.see({ type: 'card', hand: '1-0', card: card(8), faceUp: true, cardIndex: 0 }, 1);
    shown.see({ type: 'card', hand: '1-0', card: card(8), faceUp: true, cardIndex: 1 }, 2);
    shown.see({ type: 'split', hand: '1-0', newHand: '1-1', card: card(8) }, 2);
    shown.see({ type: 'reveal', hand: '1-1', card: card(8), cardIndex: 0 }, 2);
    expect(shown.running).toBe(direct(card(8), card(8)));
  });

  it('starts over at a shuffle', () => {
    const { shown, direct } = counts();
    shown.see({ type: 'card', hand: '1-0', card: card(5), faceUp: true, cardIndex: 0 }, 1);
    expect(shown.running).not.toBe(direct());
    shown.see({ type: 'shuffle' }, 0);
    expect(shown.running).toBe(direct());
  });
});

describe('chip labels', () => {
  const chip = over => ({ base: 10, amount: 10, sideBet: 0, result: null, paid: null, ...over });

  it('shows the amount bet, with any side bet', () => {
    expect(chipText(chip())).toBe('$10');
    expect(chipText(chip({ amount: 1500.5 }))).toBe('$1,500.50');
    expect(chipText(chip({ sideBet: 5 }))).toBe('$10, SB:$5');
    expect(chipText(chip({ amount: 0 }))).toBe('');
  });

  it('shows what was paid, then a result', () => {
    expect(chipText(chip({ paid: 20 }))).toBe('$20');
    expect(chipText(chip({ paid: 0 }))).toBe('$0');
    expect(chipText(chip({ result: 'Win' }))).toBe(' Win ');
  });
});

describe('the side-bet label', () => {
  it('names each spot and its amount', () => {
    expect(sideBetLabel({ Lucky: 5, Ladies: 2.5 })).toBe('Lucky side bet $5, Ladies side bet $2.50');
    expect(sideBetLabel({})).toBe('');
  });
});
