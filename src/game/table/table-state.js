// What is on the table right now, as far as the player can see.
//
// The engine finishes a round before the screen has drawn any of it, so the
// screen cannot render the engine's hands directly: it replays the engine's
// events into this model one at a time and draws that instead.

export const DEALER_KEY = '0-0';

/**
 * @param {object} o
 * @param {number} o.decks  Decks in the shoe, for the shoe photograph.
 */
export function createTableState({ decks }) {
  const emptyHand = key => ({ key, seat: Number(key.split('-')[0]), index: Number(key.split('-')[1]), cards: [], faceUp: [] });

  const state = {
    /** Player hands in play, in seat order. */
    hands: [],
    dealer: emptyHand(DEALER_KEY),
    /** The hand the turn pointer points at. */
    pointerHand: null,
    /** True while the insurance offer is up. */
    insurance: false,
    /** Cards drawn from the shoe this shoe, including burns. */
    dealt: 0,
    /** Burn cards sitting out in front of the tray: {card, faceUp}. */
    burns: [],
    /** Amount showing on each seat's chip label, by seat number. */
    chips: new Map(),
    /** What each player hand has wagered, by hand key, so a swept hand takes its chips with it. */
    stakes: new Map(),
    /** Hands already paid and swept off the table this round. */
    swept: new Set(),
    /**
     * The bankroll as the player has seen it so far. The engine's bankroll is
     * already final when the first card is drawn, so the label follows the
     * replay instead: stakes come off as they are placed and payouts arrive
     * hand by hand.
     */
    bankroll: 0,

    /** Cards sitting in the discard tray: dealt, less what is still on the table. */
    get trayCards() {
      return Math.max(0, state.dealt - state.cardsOnTable - state.burns.length);
    },

    /** Cards left in the shoe. */
    get shoeCards() {
      return Math.max(0, decks * 52 - state.dealt);
    },

    get cardsOnTable() {
      return state.hands.reduce((sum, hand) => sum + hand.cards.length, 0) + state.dealer.cards.length;
    },

    hand(key) {
      if (key === DEALER_KEY) return state.dealer;
      let found = state.hands.find(h => h.key === key);
      if (!found) {
        found = emptyHand(key);
        state.hands.push(found);
        state.hands.sort((a, b) => a.seat - b.seat || a.index - b.index);
      }
      return found;
    },

    /** Sets the bankroll the label shows. */
    setBankroll(amount) {
      state.bankroll = amount;
    },

    /** Sets what each seat has wagered, so the chip labels can be drawn. */
    setBets(bets) {
      state.chips = new Map(bets.map(({ seat, amount, sideBet = 0 }) => [seat, { base: amount, amount, sideBet, result: null, paid: null }]));
    },

    /** Clears the table for a new round. */
    clear() {
      state.hands = [];
      state.dealer = emptyHand(DEALER_KEY);
      state.pointerHand = null;
      state.insurance = false;
      state.chips = new Map();
      state.stakes = new Map();
      state.swept = new Set();
    },

    /** A seat's chip label; computer seats get one only to show their results. */
    chipFor(seat) {
      if (!state.chips.has(seat)) state.chips.set(seat, { base: 0, amount: 0, sideBet: 0, result: null, paid: null, computer: true });
      return state.chips.get(seat);
    },

    /** Adds to what a hand has wagered. */
    stake(key, amount) {
      state.stakes.set(key, (state.stakes.get(key) ?? 0) + amount);
    },

    /** Applies one engine event. */
    apply(event) {
      switch (event.type) {
        case 'shuffle':
          state.dealt = 0;
          state.burns = [];
          break;
        case 'burn':
          state.dealt += 1;
          state.burns.push({ card: event.card, faceUp: Boolean(event.faceUp) });
          break;
        case 'burnsToTray':
          state.burns = [];
          break;
        case 'roundStart':
          // The burn cards are gathered up before the deal, if they were not already.
          state.burns = [];
          break;
        case 'card': {
          const chip = state.chips.get(Number(event.hand.split('-')[0]));
          if (event.hand !== DEALER_KEY && chip && !state.stakes.has(event.hand)) state.stake(event.hand, chip.base);
          const hand = state.hand(event.hand);
          hand.cards.push(event.card);
          hand.faceUp.push(event.faceUp);
          state.dealt += 1;
          break;
        }
        case 'reveal':
        case 'peek': {
          const hand = state.hand(event.hand);
          hand.faceUp[event.cardIndex] = true;
          break;
        }
        case 'conceal': {
          const hand = state.hand(event.hand);
          hand.faceUp[event.cardIndex] = false;
          break;
        }
        case 'split': {
          // The engine moved the second card to a new hand of its own.
          const from = state.hand(event.hand);
          from.cards.pop();
          const faceUp = from.faceUp.pop();
          const to = state.hand(event.newHand);
          to.cards.push(event.card);
          to.faceUp.push(faceUp ?? true);
          // The new hand carries a bet of its own.
          const chip = state.chips.get(from.seat);
          if (chip) {
            chip.amount += chip.base;
            state.bankroll -= chip.base;
            state.stake(event.newHand, chip.base);
          }
          break;
        }
        case 'double': {
          const bet = state.chips.get(state.hand(event.hand).seat);
          if (bet) {
            bet.amount += event.amount;
            state.bankroll -= event.amount;
            state.stake(event.hand, event.amount);
          }
          break;
        }
        case 'offerInsurance':
          state.insurance = true;
          break;
        case 'insuranceTaken':
          state.insurance = false;
          // Insurance costs half the bet on each hand that has one.
          for (const [seat, chip] of state.chips) {
            chip.amount += chip.base / 2;
            state.bankroll -= chip.base / 2;
            state.stake(`${seat}-0`, chip.base / 2);
          }
          break;
        case 'insuranceDeclined':
          state.insurance = false;
          break;
        case 'insuranceLost':
          // The dealer takes the insurance chips as soon as it has checked.
          for (const [seat, chip] of state.chips) {
            chip.amount -= chip.base / 2;
            state.stake(`${seat}-0`, -chip.base / 2);
          }
          break;
        case 'turn':
          state.pointerHand = event.hand;
          break;
        case 'dealerTurn':
          state.pointerHand = null;
          break;
        case 'result':
          // The pointer leaves before a hand is paid.
          if (state.pointerHand === event.hand) state.pointerHand = null;
          state.chipFor(state.hand(event.hand).seat).result = event.result;
          break;
        case 'settled': {
          if (state.pointerHand === event.hand) state.pointerHand = null;
          const chip = state.chips.get(event.seat);
          if (chip && !chip.computer) state.bankroll += event.payout;
          if (!state.swept.has(event.hand)) state.chipFor(event.seat).result = event.result;
          break;
        }
        case 'payout': {
          const chip = state.chipFor(state.hand(event.hand).seat);
          chip.result = null;
          chip.paid = event.amount;
          break;
        }
        case 'sweep': {
          // The hand's cards go to the tray and its chips leave the seat.
          const { seat } = state.hand(event.hand);
          state.hands = state.hands.filter(h => h.key !== event.hand);
          state.swept.add(event.hand);
          const chip = state.chipFor(seat);
          Object.assign(chip, { result: null, paid: null, amount: chip.amount - (state.stakes.get(event.hand) ?? 0) });
          if (!state.hands.some(h => h.seat === seat)) Object.assign(chip, { amount: 0, sideBet: 0 });
          break;
        }
        case 'roundEnd':
          state.bankroll = event.bankroll;
          break;
        case 'clear':
          state.clear();
          break;
        default:
          break;
      }
    },
  };
  return state;
}
