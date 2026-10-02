// Reference-behavior captures for the four drills. Each capture runs inside a
// page opened with openLegacy() and returns plain JSON.
//
// tools/capture-drill-fixtures.mjs saves the results to tests/fixtures/, and
// tests/legacy/drills.spec.js re-runs them to prove the fixtures still describe
// the original app.

/** Counting systems used across the drill captures. */
export const DRILL_SYSTEMS = [30, 31, 20, 32, 5, 50, 73, 96];

const SITUATIONS = ['hardStand', 'softStand', 'hardDouble', 'softDouble', 'split', 'surrender'];
const allSituations = () => Object.fromEntries(SITUATIONS.map(k => [k, true]));
const only = (...names) => Object.fromEntries(SITUATIONS.map(k => [k, names.includes(k)]));

/** Hand lists to capture: every Hands option, plus a few situation subsets. */
export const HAND_LIST_CONFIGS = [
  ...['default', 'illustrious18', 'withIndices'].map(hands => ({ hands, situations: allSituations(), system: 30, decks: 6 })),
  { hands: 'withIndices', situations: allSituations(), system: 31, decks: 2, h17: true },
  { hands: 'withIndices', situations: allSituations(), system: 20, decks: 6 },
  { hands: 'withIndices', situations: allSituations(), system: 5, decks: 6 },
  { hands: 'withIndices', situations: only('hardStand'), system: 30, decks: 6 },
  { hands: 'withIndices', situations: only('split', 'surrender'), system: 30, decks: 6 },
  { hands: 'withIndices', situations: only('softStand', 'softDouble'), system: 31, decks: 6, das: true },
  {
    hands: 'custom',
    situations: allSituations(),
    system: 30,
    decks: 6,
    mask: [['hardStand', 0, 0], ['hardStand', 7, 9], ['split', 2, 5], ['surrender', 5, 3], ['softStand', 1, 8], ['softDouble', 7, 0], ['hardDouble', 3, 4]],
  },
  { hands: 'custom', situations: only('split'), system: 30, decks: 6, mask: [['split', 0, 0], ['split', 9, 9]] },
  { hands: 'custom', situations: allSituations(), system: 30, decks: 6, mask: [] },
  {
    hands: 'drillErrors',
    situations: allSituations(),
    system: 30,
    decks: 6,
    tallies: [['hardStand', 1, 8], ['hardStand', 1, 8], ['split', 5, 2], ['softDouble', 2, 3]],
  },
  { hands: 'drillErrors', situations: only('hardDouble'), system: 30, decks: 6, tallies: [['hardStand', 1, 8]] },
];

/**
 * Builds the hand list of each config the way `cmdStart_Click` does, and reads
 * the packed list back out.
 */
export function captureFlashHandListsInPage({ configs }) {
  const g = window;
  const noop = () => {};
  const fake = new Proxy({}, { get: () => noop, set: () => true });
  const HANDS_SLOT = { default: 0, illustrious18: 3, withIndices: 6, drillErrors: 4, custom: 2 };
  const SITUATION_SLOT = { hardDouble: 0, softDouble: 1, split: 2, hardStand: 3, surrender: 4, softStand: 5 };
  const MASKS = { hardStand: 'DMaskcchs', hardDouble: 'DMaskcchd', split: 'DMaskccsp', surrender: 'DMaskccsu', softStand: 'DMaskccsh', softDouble: 'DMaskccsd' };
  const TALLIES = { hardStand: 'xxffhs', hardDouble: 'xxffhd', split: 'xxffsp', surrender: 'xxffsu', softStand: 'xxffsh', softDouble: 'xxffsd' };

  let message = null;
  g.MyMsgBox = m => { message = m; };
  g.NSB.MsgBox = m => { message = m; };
  // The drill form's canvas and timers are not needed to build the list.
  g.doit = () => { g.DoAg999 = false; };
  g.makebuttons = noop;
  g.enablehits = noop;
  g.showstats = noop;
  g.Godom = { setValue: noop, getValue: () => '' };
  g.pb1 = fake;
  // DoDef mis-types its first call after page load; run it once to get past that.
  g.ListType = [];
  g.ListC = [];
  g.DoDef();

  const clearGrids = names => {
    for (const name of Object.values(names)) {
      for (let row = 0; row < 10; row++) for (let column = 0; column < 23; column++) g[name][row][column] = name.startsWith('xx') ? 0 : false;
    }
  };

  return configs.map(config => {
    message = null;
    g.namnamccsys = config.system;
    g.namnamoptdecks = config.decks;
    g.cardsindeck = 52;
    g.optdlr17 = Boolean(config.h17);
    g.optddsplit = Boolean(config.das);
    g.optnoholecard = false;
    g.namLimitOpt = 0;
    g.namnamrange = 99;
    g.namnamrange2 = -99;
    g.namnamOptForceRC = false;
    g.CCLoad2();
    clearGrids(MASKS);
    clearGrids(TALLIES);
    for (const [table, row, column] of config.mask ?? []) g[MASKS[table]][row][column] = true;
    for (const [table, row, column] of config.tallies ?? []) g[TALLIES[table]][row][column] += 1;
    g.opth = [];
    g.opth[HANDS_SLOT[config.hands]] = true;
    g.optb = [];
    for (const [name, slot] of Object.entries(SITUATION_SLOT)) g.optb[slot] = Boolean(config.situations[name]);
    g.opta = [];
    g.opta[0] = true;
    g.optdd = [];
    g.optdd[3] = true;
    g.optt = [];
    g.optt[0] = true;
    g.optC = [];
    g.optC[3] = true;
    g.namnamflashtextbox2 = 50;
    g.CurrentSpeed = 10;
    g.optProg = false;
    g.ListTop = 0;
    g.cmdStart_Click(1);
    const list = [];
    for (let i = 0; i < g.ListTop; i++) {
      list.push([Math.floor(g.ListC[i] / 256), g.ListC[i] % 256, g.ListType[i] || 0]);
    }
    return { config, message, list };
  });
}

/** Hands whose index, correct play and error attribution are captured. */
export const PLAY_HANDS = [
  { total: 16, hardTotal: 16, card1: 10, card2: 6, cards: 2, kind: 'hardStand' },
  { total: 12, hardTotal: 12, card1: 10, card2: 2, cards: 2, kind: 'hardStand' },
  { total: 15, hardTotal: 15, card1: 9, card2: 6, cards: 2, kind: 'hardStand' },
  { total: 16, hardTotal: 16, card1: 8, card2: 8, cards: 2, kind: 'split' },
  { total: 20, hardTotal: 20, card1: 10, card2: 10, cards: 2, kind: 'split' },
  { total: 12, hardTotal: 2, card1: 1, card2: 1, cards: 2, kind: 'split' },
  { total: 18, hardTotal: 8, card1: 1, card2: 7, cards: 2, kind: 'softStand' },
  { total: 19, hardTotal: 9, card1: 1, card2: 8, cards: 2, kind: 'softStand' },
  { total: 17, hardTotal: 7, card1: 1, card2: 6, cards: 2, kind: 'softDouble' },
  { total: 13, hardTotal: 3, card1: 1, card2: 2, cards: 2, kind: 'softDouble' },
  { total: 11, hardTotal: 11, card1: 5, card2: 6, cards: 2, kind: 'hardDouble' },
  { total: 9, hardTotal: 9, card1: 4, card2: 5, cards: 2, kind: 'hardDouble' },
  { total: 10, hardTotal: 10, card1: 2, card2: 8, cards: 2, kind: 'hardDouble' },
  { total: 14, hardTotal: 14, card1: 7, card2: 7, cards: 2, kind: 'split' },
  { total: 16, hardTotal: 16, card1: 6, card2: 4, cards: 3, kind: 'hardStand' },
  { total: 17, hardTotal: 7, card1: 1, card2: 2, cards: 3, kind: 'softStand' },
];

export const PLAY_UPCARDS = [2, 5, 6, 7, 9, 10, 1];

/** Strategies the play captures run against. */
export const PLAY_CONFIGS = [
  { system: 30, decks: 6 }, { system: 30, decks: 6, h17: true, das: true },
  { system: 30, decks: 6, doubleAnyCards: true },
  { system: 31, decks: 2 }, { system: 20, decks: 6 }, { system: 5, decks: 6 },
];
export const PLAY_COUNTS = [-5, -2, 0, 1, 3, 6];

/**
 * For each hand: the index its own table holds (what the drill centres a random
 * count on and the index test asks for), and the action, deciding table and row
 * for a set of counts.
 *
 * The call sequences below are transcriptions of `doit` (the index) and
 * `cmdhit_click` (the correct play), including how they treat hands of more than
 * two cards.
 */
export function captureFlashPlayInPage({ configs, hands, upcards, counts }) {
  const g = window;
  const KINDS = { hardDouble: 0, softDouble: 1, split: 2, surrender: 3 };
  const results = [];
  for (const config of configs) {
    g.namnamccsys = config.system;
    g.namnamoptdecks = config.decks;
    g.cardsindeck = 52;
    g.optdlr17 = Boolean(config.h17);
    g.optddsplit = Boolean(config.das);
    g.optnoholecard = false;
    g.optdoubleany = Boolean(config.doubleAnyCards);
    g.namLimitOpt = 0;
    g.namnamrange = 99;
    g.namnamrange2 = -99;
    g.namnamOptForceRC = false;
    g.optZeroRC = false;
    g.CCLoad2();
    for (const hand of hands) {
      for (const upcard of upcards) {
        const soft = hand.total !== hand.hardTotal;
        g.cards[2] = 0;
        // `doit`: the hand's own index, from its own table only.
        g.nextplayercard = hand.cards;
        const own = [false, false, false, false];
        if (KINDS[hand.kind] !== undefined) own[KINDS[hand.kind]] = true;
        g.suggested_play(hand.total, hand.hardTotal, upcard, hand.card1, hand.card2, own[0], own[1], own[2], own[3], 3, 99);
        let index = g.CTmp;
        if (index === 32000 || index === 1234) {
          g.suggested_play(hand.total, hand.hardTotal, upcard, hand.card1, hand.card2, true, true, true, false, 0, 99);
          index = g.CTmp;
        }
        if (index === -32000 || index === 32000 || index === 1234) index = g.ccins / 10;
        if (index > 150 || index < -150) index = null;

        // `cmdhit_click`: the correct play at the shown count.
        const plays = counts.map(count => {
          g.nextplayercard = hand.cards;
          if (hand.cards === 2) {
            g.suggested_play(hand.total, hand.hardTotal, upcard, hand.card1, hand.card2, true, true, true, true, 0, count);
          } else {
            const card1 = soft ? 1 : hand.card1;
            const card2 = soft ? hand.total - 11 : hand.card2;
            const dd = Boolean(config.doubleAnyCards);
            g.suggested_play(hand.total, hand.hardTotal, upcard, card1, card2, dd, dd, false, false, 0, count);
          }
          return { count, action: g.hitstand, table: g.xxdid, row: g.xxplayer };
        });
        results.push({ config, hand, upcard, index, plays });
      }
    }
  }
  return results;
}

const DEPTH_DRILL_SLOT = { decksLeft: 0, halfDecksLeft: 1, quarterDecksLeft: 8, acesLeft: 2, trueCount: 10, trueCountAndDecks: 9 };
const RESOLUTION_SLOT = { full: 0, half: 1, quarter: 2 };

/** Depth answer grids to capture: every drill, resolution, deck count and side. */
export const DEPTH_GRID_CONFIGS = (() => {
  const configs = [];
  for (const drill of Object.keys(DEPTH_DRILL_SLOT)) {
    for (const resolution of Object.keys(RESOLUTION_SLOT)) {
      for (const decks of [1, 2, 6, 8]) {
        for (const askInTray of [false, true]) configs.push({ drill, resolution, decks, askInTray });
      }
    }
  }
  return configs;
})();

/** The labels of the Depth answer grid, as `karray[column][row]`. */
export function captureDepthGridsInPage({ configs }) {
  const g = window;
  const noop = () => {};
  const fake = new Proxy({}, { get: () => noop, set: () => true });
  const DRILL_SLOT = { decksLeft: 0, halfDecksLeft: 1, quarterDecksLeft: 8, acesLeft: 2, trueCount: 10, trueCountAndDecks: 9 };
  const RES_SLOT = { full: 0, half: 1, quarter: 2 };
  g.pb2 = fake;
  g.DrawButton = noop;
  g.picbuttons33 = { Width: 360, Height: 240 };
  g.SmallD = false;
  g.namnamccsys = 30;
  g.CCLoad2();
  return configs.map(config => {
    g.optB3 = [];
    g.optB3[DRILL_SLOT[config.drill]] = true;
    g.optA3 = [];
    g.optA3[4] = config.askInTray;
    g.optA3[3] = !config.askInTray;
    g.optC = [];
    g.optC[RES_SLOT[config.resolution]] = true;
    g.optC[3] = true;
    g.namnamoptdecks = config.decks;
    g.ss42 = 40;
    g.ss34 = 40;
    g.xx = 40;
    g.yy = 40;
    g.karray = Array.from({ length: 12 }, () => new Array(12).fill(''));
    g.makebuttons33();
    const columns = g.karray.slice(0, 12).map(row => row.slice(0, 12));
    return { config, rows: 4 - g.AdjK, columns };
  });
}

/** Tray photos to capture: every style, deck count and quarter-deck depth. */
export const TRAY_CONFIGS = (() => {
  const configs = [];
  for (const style of [0, 1, 2, 3, 4]) {
    for (const decks of [1, 2, 6, 8]) {
      for (let quarters = 1; quarters <= decks * 4; quarters++) configs.push({ style, decks, decksInTray: quarters / 4 });
    }
  }
  return configs;
})();

/** Which photo `show_discards` picks for a depth, and when it gives up. */
export function captureDepthTraysInPage({ configs }) {
  const g = window;
  return configs.map(config => {
    g.ActiveTrayStyle = config.style;
    g.namnamoptdecks = config.decks;
    g.FailedDisplay = false;
    g.show_discards(12.5 * (8 - config.decksInTray));
    const src = g.TrayImages ? String(g.TrayImages.src) : '';
    const match = src.match(/xstw(\d+)\.jpg/);
    return {
      config,
      image: config.failed ? null : (match ? Number(match[1]) : null),
      failed: Boolean(g.FailedDisplay),
      crop: [g.svi1, g.svi2],
    };
  });
}

/** Count-drill answer sequences to capture. */
export const COUNT_ANSWER_CONFIGS = (() => {
  const configs = [];
  for (const system of [30, 20, 32, 96, 50, 5]) {
    for (const decks of [1, 6]) {
      // Rounding 3 is the exact (unrounded) true count, which pins the division
      // and the ace adjustment; 1 and 2 are truncate and floor.
      for (const rounding of [1, 2, 3]) configs.push({ system, decks, rounding, division: 0, lastDeck: 1 });
    }
  }
  for (const division of [1, 2, 3]) {
    for (const lastDeck of [1, 2, 3]) configs.push({ system: 30, decks: 6, rounding: 3, division, lastDeck });
  }
  return configs;
})();

/**
 * Deals a fixed sequence of cards and records every count the drills can ask
 * for after each one: running count, true count, aces, tens and the three
 * ace-adjusted counts.
 */
export function captureCountAnswersInPage({ configs, cards }) {
  const g = window;
  return configs.map(config => {
    g.namnamccsys = config.system;
    g.namnamoptdecks = config.decks;
    g.xoptdecks = config.decks;
    g.cardsindeck = 52;
    g.optdlr17 = false;
    g.optddsplit = false;
    g.optnoholecard = false;
    g.namLimitOpt = 0;
    g.namnamrange = 99;
    g.namnamrange2 = -99;
    g.namnamOptForceRC = false;
    g.CCLoad2();
    // CCLoad2 rewrites the true-count settings, so they go in afterwards.
    g.namnamtcr = config.division;
    g.namnamtcl = config.lastDeck;
    g.namnamtcd = config.rounding;
    g.namnamtde = 0;
    g.namnamtcx = 0;
    g.namnamsidecountaces = false;
    g.ignoreupdate = false;
    g.drillactive = true;
    // The Count drill keeps the number of cards *remaining* in `cardsdealt`.
    g.wholecount = g.usIRC[config.decks - 1];
    g.truecount = g.wholecount;
    g.betcount = g.wholecount;
    g.playcount = g.wholecount;
    g.inscount = g.wholecount;
    g.acecount = 0;
    g.tencount = 0;
    g.cardsdealt = config.decks * 52;
    const steps = [];
    for (const card of cards) {
      if (g.cardsdealt <= 0) break;
      g.cardsdealt -= 1;
      g.updatecount(card);
      g.getans();
      steps.push({
        card,
        running: g.wholecount,
        trueCount: g.truecount,
        bet: g.betcount,
        play: g.playcount,
        insure: g.inscount,
        aces: g.acecount,
        tens: g.tencount,
      });
    }
    return { config, steps };
  });
}

/** A fixed, repeatable spread of card ids to deal in the count captures. */
export const COUNT_CARDS = (() => {
  const cards = [];
  let value = 7;
  for (let i = 0; i < 120; i++) {
    value = (value * 31 + 17) % 52;
    cards.push(value + 1);
  }
  return cards;
})();
