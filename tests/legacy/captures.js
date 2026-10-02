// Reference-behavior captures. Each capture runs inside a page opened with
// openLegacy() and returns plain JSON. tools/capture-fixtures.mjs saves the
// results to tests/fixtures/, and tests/legacy/*.spec.js re-runs them to prove
// the recorded fixtures are reproducible.

export const STRATEGY_IDS = [5, 30, 31, 32, 35, 73, 74, 75, 76, 77, 6, 7, 80, 81, 2, 3, 92, 82, 83, 20, 22, 96, 24, 25, 26, 27, 97, 28, 29, 50, 51, 52, 90, 91, 40, 70, 71, 60, 61, 42, 99];
export const DRILL_STRATEGY_IDS = STRATEGY_IDS.filter(id => ![35, 92, 99].includes(id));

const BASE = { decks: 6, h17: false, das: false, noHoleCard: false, indexSet: 0, rangeHigh: 99, rangeLow: -99, forceRC: false, forceRCValue: 0 };

export function strategyConfigs(ids) {
  const configs = [];
  for (const system of ids) configs.push({ ...BASE, system });
  const reps = [5, 30, 31, 2, 7, 73, 32, 50].filter(id => ids.includes(id));
  for (const system of reps) {
    for (const decks of [1, 2, 4, 6, 8]) for (const h17 of [false, true]) for (const das of [false, true]) for (const noHoleCard of [false, true]) {
      if (decks === 6 && !h17 && !das && !noHoleCard) continue;
      configs.push({ ...BASE, system, decks, h17, das, noHoleCard });
    }
    for (const indexSet of [1, 2, 3, 4]) for (const decks of [1, 6]) configs.push({ ...BASE, system, decks, indexSet });
    for (const [rangeLow, rangeHigh] of [[-2, 2], [0, 5], [-99, 3], [-4, 99]]) configs.push({ ...BASE, system, rangeLow, rangeHigh });
    for (const forceRCValue of [0, 4]) configs.push({ ...BASE, system, decks: 2, forceRC: true, forceRCValue });
  }
  return configs;
}

/** Runs CCLoad2 for each config and returns the resulting tables and count parameters. */
export function captureStrategyTablesInPage({ app, configs }) {
  const g = window;
  const trim = row => { const r = Array.from(row); while (r.length && (r[r.length - 1] === undefined || r[r.length - 1] === null || r[r.length - 1] === '')) r.pop(); return r; };
  const table = (t, cols) => Array.from(t).slice(0, 10).map(r => trim(r).slice(0, cols));
  const list = (a, from, to) => { const r = []; for (let i = from; i <= to; i++) r.push(a[i]); return r; };
  return configs.map(c => {
    g.namnamccsys = c.system;
    g.namnamoptdecks = c.decks;
    g.namnamrange = c.rangeHigh;
    g.namnamrange2 = c.rangeLow;
    g.namnamOptForceRC = c.forceRC;
    g.namnamOptForceRCV = c.forceRCValue;
    if (app === 'game') {
      g.LimitOpt = c.indexSet;
      g.GetOpt[g.optdlr17] = c.h17; g.GetOpt[g.optddsplit] = c.das; g.GetOpt[g.optnoholecard] = c.noHoleCard;
    } else {
      g.namLimitOpt = c.indexSet;
      g.optdlr17 = c.h17; g.optddsplit = c.das; g.optnoholecard = c.noHoleCard;
    }
    g.CCLoad2();
    const cols = g.USExtendOn ? 23 : 10;
    return {
      config: c,
      name: g.ccsys,
      tables: { split: table(g.ccsp, cols), hardStand: table(g.cchs, cols), softDouble: table(g.ccsd, cols), hardDouble: table(g.cchd, cols), softStand: table(g.ccsh, cols), surrender: table(g.ccsu, cols) },
      countValues: list(g.ccc, 1, 10),
      countValuesBlack: list(g.ccc2, 1, 10),
      insurance: g.ccins,
      insuranceByTotal: list(g.ccinsHT, 0, 9),
      trueCountType: g.cctc,
      pivot: g.Pivot,
      realPivot: g.realpivot,
      ircAdjust: g.IRCAdjust,
      initialRunningCount: list(g.usIRC, 0, 7),
      insuranceByDecks: list(g.usins, 1, 8),
      sideCounts: list(g.usSideCounts, 0, 10),
      groups: Array.from(g.usGroups).slice(0, 8).map(r => Array.from(r).slice(0, 5)),
      flags: { kiss: g.KissOn, earlySurrender: g.EarlySurrOn, extended: g.USExtendOn, halves: g.HalvesOn, unbalanced: app === 'game' ? g.UnbFlag : null },
      file: { decks: g.usdecks, ops: list(g.usops, 0, 4), sideCount: g.ussidecount, start: g.usstart, startAdj: g.usstartadj, redBlack: g.usRB, halves: g.usHalves },
    };
  });
}

export const ADVISOR_CONFIGS = [
  { system: 30, decks: 6 }, { system: 30, decks: 6, h17: true, das: true }, { system: 30, decks: 1, noHoleCard: true },
  { system: 31, decks: 6, indexSet: 1 }, { system: 31, decks: 2 }, { system: 5, decks: 6 }, { system: 2, decks: 1 },
  { system: 7, decks: 2, h17: true }, { system: 50, decks: 6 }, { system: 73, decks: 6 }, { system: 90, decks: 6 },
  { system: 91, decks: 6 }, { system: 29, decks: 6, das: true }, { system: 92, decks: 6 }, { system: 99, decks: 6 },
].map(c => ({ ...BASE, ...c }));

export const ADVISOR_COUNTS = [-10, -6, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 8, 10];

export const ADVISOR_PERMISSIONS = [
  { ddok: true, sdok: true, spok: true, suok: true },
  { ddok: true, sdok: true, spok: true, suok: false },
  { ddok: false, sdok: false, spok: false, suok: false },
];

/**
 * Calls the play advisor for every two-card hand x upcard x true count (plus a
 * set of multi-card hands) and returns one compact record string per call:
 * "hitstand,xxdid,xxplayer,DDLess?1:0,CTmp". `probeModes` lists extra `inok`
 * values to record (the drills probe single strategy sections with 2 and 3).
 */
export function captureAdvisorInPage({ app, configs, permissions, counts, probeModes = [0] }) {
  const g = window;
  const advise = app === 'game' ? g.suggested_play2 : g.suggested_play;
  const out = [];
  for (const c of configs) {
    g.namnamccsys = c.system; g.namnamoptdecks = c.decks; g.namnamrange = c.rangeHigh; g.namnamrange2 = c.rangeLow;
    g.namnamOptForceRC = false;
    if (app === 'game') {
      g.LimitOpt = c.indexSet; g.GetOpt[g.optdlr17] = c.h17; g.GetOpt[g.optddsplit] = c.das; g.GetOpt[g.optnoholecard] = c.noHoleCard;
      g.GetOpt[g.optZeroRC] = false; g.DidPeek = false; g.hands[g.handinplay] = 0;
    } else {
      g.namLimitOpt = c.indexSet; g.optdlr17 = c.h17; g.optddsplit = c.das; g.optnoholecard = c.noHoleCard; g.optZeroRC = false;
    }
    g.CCLoad2();
    g.cardsdealt = 0; g.cardsindeck = 52; g.bustouton = false; g.yydid = -99; g.sumcard1x = 1; g.sumcard2x = 14;
    const hands = [];
    for (let c1 = 1; c1 <= 10; c1++) for (let c2 = c1; c2 <= 10; c2++) {
      const best = c1 + c2 + ((c1 === 1 || c2 === 1) ? 10 : 0);
      hands.push({ hc: best, sc: c1 + c2, c1, c2, n: 2 });
    }
    for (let hard = 5; hard <= 21; hard++) hands.push({ hc: hard, sc: hard, c1: 2, c2: Math.min(10, Math.max(2, hard - 4)), n: 3 });
    for (let other = 2; other <= 10; other++) hands.push({ hc: 11 + other, sc: 1 + other, c1: 1, c2: other, n: 3 });
    const results = [];
    for (const inok of probeModes) for (const h of hands) for (let up = 1; up <= 10; up++) for (const p of permissions) for (const tc of counts) {
      g.nextplayercard = h.n; g.wholecount = tc; g.TrueCountReal = tc; g.inscount = tc;
      g.DealerTotal = up === 1 ? 11 : up; g.DealerTotalS = up;
      g.hitstand = -1; g.DDLess = false; g.xxdid = -1; g.xxplayer = -1; g.CTmp = -1;
      advise(h.hc, h.sc, up, h.c1, h.c2, p.ddok, p.sdok, p.spok, p.suok, inok, tc);
      results.push(`${g.hitstand},${g.xxdid},${g.xxplayer},${g.DDLess ? 1 : 0},${Number(g.CTmp)}`);
    }
    const insurance = [];
    for (const tc of counts) {
      g.TrueCountReal = tc; g.inscount = tc; g.hitstand = -1;
      advise(12, 12, 1, 2, 10, false, false, false, false, app === 'game' ? true : -1, tc);
      insurance.push(g.hitstand);
    }
    out.push({ config: c, probeModes, hands, results, insurance });
  }
  return out;
}

export function countingConfigs(ids) {
  const configs = [];
  const tc = { division: 0, lastDeck: 1, rounding: 2 };
  for (const system of [30, 31, 2, 7, 73, 32, 50, 80, 6, 40, 70, 82].filter(id => ids.includes(id))) {
    for (const decks of [1, 2, 6, 8]) configs.push({ system, decks, ...tc, aceSideCount: false });
  }
  for (const [system, decks] of [[30, 6], [7, 2], [2, 1], [73, 6]]) {
    for (let division = 0; division <= 3; division++) for (let lastDeck = 1; lastDeck <= 3; lastDeck++) for (let rounding = 0; rounding <= 3; rounding++) {
      configs.push({ system, decks, division, lastDeck, rounding, aceSideCount: false });
    }
  }
  for (const system of [6, 7, 22]) if (ids.includes(system)) configs.push({ system, decks: 6, ...tc, aceSideCount: true });
  return configs;
}

/** Deals a seeded shoe card by card through updatecount() and records the counts after each card. */
export function captureCountingInPage({ app, configs, cardsPerConfig }) {
  const g = window;
  let seed;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  return configs.map(c => {
    seed = c.system * 1000 + c.decks * 100 + c.division * 27 + c.lastDeck * 9 + c.rounding * 3 + (c.aceSideCount ? 1 : 0);
    g.namnamccsys = c.system; g.namnamoptdecks = c.decks; g.namnamrange = 99; g.namnamrange2 = -99; g.namnamOptForceRC = false;
    if (app === 'game') { g.LimitOpt = 0; g.GetOpt[g.optdlr17] = false; g.GetOpt[g.optddsplit] = false; g.GetOpt[g.optnoholecard] = false; }
    else { g.namLimitOpt = 0; g.optdlr17 = false; g.optddsplit = false; g.optnoholecard = false; }
    g.CCLoad2();
    g.namnamtcr = c.division; g.namnamtcl = c.lastDeck; g.namnamtcd = c.rounding; g.namnamtde = 0; g.namnamtcx = 0;
    g.drillactive = true; g.ignoreupdate = false; g.xoptdecks = c.decks; g.cardsindeck = 52;
    g.namnamsidecountaces = c.aceSideCount;
    if (g.CardsRemoved) g.CardsRemoved[0] = 0;
    const shoe = [];
    for (let d = 0; d < c.decks; d++) for (let card = 1; card <= 52; card++) shoe.push(card);
    for (let i = shoe.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [shoe[i], shoe[j]] = [shoe[j], shoe[i]]; }
    g.wholecount = g.usIRC[c.decks - 1]; g.acecount = 0; g.tencount = 0; g.truecount = g.wholecount; g.TrueCountReal = 0; g.betcount = g.wholecount;
    const steps = [];
    const n = Math.min(cardsPerConfig, shoe.length - 1);
    for (let i = 0; i < n; i++) {
      g.cardsdealt = i + 1;
      g.updatecount(shoe[i]);
      steps.push([g.wholecount, g.truecount, g.TrueCountReal, g.acecount, g.tencount, g.betcount, g.decks_left(c.decks, g.cardsdealt)].map(v => (v === 0 ? 0 : v)));
    }
    return { config: c, initial: g.usIRC[c.decks - 1], shoe: shoe.slice(0, n), steps };
  });
}

/** Snapshot of everything a fresh install writes to localStorage. */
export function captureFreshStorageInPage() {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    out[k] = localStorage.getItem(k);
  }
  return out;
}
