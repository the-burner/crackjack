// Reference-behavior captures for the strategy table viewer (legacy frmtabhn).
// Each capture runs inside a page opened with openLegacy() and returns plain
// JSON; tools/capture-strategy-screen-fixtures.mjs saves the results to
// tests/fixtures/ and tests/legacy/strategy-screens.spec.js re-runs them.

/** `tablenum` values in the order the table picker lists them. */
export const TABLE_NUMBERS = [0, 4, 1, 2, 3, 5];

const BASE = { decks: 6, h17: false, das: false, noHoleCard: false, indexSet: 0 };

/** Strategies worth comparing: plain, unbalanced, KISS, extended, early surrender. */
export const VIEW_CONFIGS = [
  { ...BASE, system: 30, h17: true, das: true },
  { ...BASE, system: 30 },
  { ...BASE, system: 31, decks: 2 },
  { ...BASE, system: 32 },
  { ...BASE, system: 5 },
  { ...BASE, system: 73 },
  { ...BASE, system: 50 },
  { ...BASE, system: 80, decks: 2 },
  { ...BASE, system: 90 },
  { ...BASE, system: 91 },
  { ...BASE, system: 7, decks: 2, h17: true },
  { ...BASE, system: 29, das: true },
  { ...BASE, system: 96 },
  { ...BASE, system: 30, indexSet: 1 },
  { ...BASE, system: 30, indexSet: 3 },
  { ...BASE, system: 30, indexSet: 4 },
  { ...BASE, system: 31, rangeLow: -4, rangeHigh: 6 },
  // Last: rendering an extended strategy leaves the shared column headers
  // rewritten as player totals, which would corrupt every later config.
  { ...BASE, system: 92 },
];

/**
 * Renders every table of every config through DoTab() and records what the grid
 * shows: each cell's text and background colour, the row and column headers,
 * the four legend boxes and the Specialty Plays list. For the Insurance/Counts
 * view the four small grids are recorded instead.
 */
export function captureTableViewsInPage({ configs, tableNumbers }) {
  const g = window;
  // Cells added by G1.addCols() get no id, so read the table's own rows.
  const cellAt = (name, r, c) => document.getElementById(name)?.rows[r]?.cells[c] ?? null;
  const grid = (name, rows, cols) => {
    const out = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const cell = cellAt(name, r, c);
        row.push(cell ? [cell.textContent, cell.style.backgroundColor, cell.style.color] : [null, null, null]);
      }
      out.push(row);
    }
    return out;
  };
  // Read the rendered cell, not getValue(), which returns escaped HTML.
  const list1 = () => {
    const rows = [];
    for (let i = 1; i < g.List1.getRowCount(); i++) rows.push(cellAt('List1', i, 0)?.textContent ?? null);
    return rows;
  };

  g.defineit2 = 0;
  g.DoMaskD = false;
  g.FlashDrill = false;

  return configs.map(config => {
    g.namnamccsys = config.system;
    g.namnamoptdecks = config.decks;
    g.LimitOpt = config.indexSet;
    g.namnamrange = config.rangeHigh ?? 99;
    g.namnamrange2 = config.rangeLow ?? -99;
    g.namnamOptForceRC = false;
    g.namnamOptForceRCV = 0;
    g.GetOpt[g.optdlr17] = config.h17;
    g.GetOpt[g.optddsplit] = config.das;
    g.GetOpt[g.optnoholecard] = config.noHoleCard;
    g.CCLoad2();
    g.DispTab();
    g.frmtabhnonshow2();
    const cols = g.NumCols;
    const views = tableNumbers.map(tablenum => {
      g.tablenum = tablenum;
      g.DoTab();
      const cells = grid('G1', 11, cols + 1);
      return {
        tablenum,
        caption: g.cctable,
        columnLabels: cells[0].slice(1).map(c => c[0]),
        rowLabels: cells.slice(1).map(r => r[0][0]),
        cells: cells.slice(1).map(r => r.slice(1).map(c => c[0])),
        colors: cells.slice(1).map(r => r.slice(1).map(c => c[1])),
        textColors: cells.slice(1).map(r => r.slice(1).map(c => c[2])),
        legend: [g.boxt4, g.boxt5, g.boxt6, g.boxt0].map(box => (box.Visible ? box.textContent : null)),
        specialty: list1(),
      };
    });
    g.tablenum = 6;
    g.DoTab();
    const counts = {
      pointValues: grid('G10', 3, 11).slice(1).map(r => r.map(c => c[0])),
      startingCount: grid('G11', 2, 8).slice(1).map(r => r.map(c => c[0])),
      insuranceDecks: grid('G12', 2, 8).slice(1).map(r => r.map(c => c[0])),
      insuranceHands: grid('G13', 2, 10).slice(1).map(r => r.map(c => c[0])),
      rule: g.Label105.textContent,
    };
    return { config, name: g.ccsys, extended: Boolean(g.usExtend), earlySurrender: Boolean(g.usESurr), columns: cols, views, counts };
  });
}
