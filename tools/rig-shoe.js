// Rigs the game's shoe, to see a hand you would otherwise wait for (splits, resplits, long hands).
//
// 1. `npm run dev` and open http://localhost:5173/ (the dev server only: it serves the source modules).
// 2. Paste this whole file into the browser's console. It logs "rig ready".
// 3. Call rig() with the ranks to deal next, 1 = ace .. 13 = king, then deal:
//      rig(Array(60).fill(8))           every card an 8: every seat splits as often as the rules allow
//      rig([8, 8, 10, 8, 8, 10, 8, 3])  these cards in the order the engine draws them, computer seats
//                                       and the dealer among them (simplest at one seat, no computers)
//    Once the list runs out (or a rank has none left in the shoe) the cards are random again.
//    A reload undoes it; paste the file again.

import('/src/game/engine/shoe.ts').then(({ Shoe }) => {
  const draw = Shoe.prototype.draw;
  globalThis.rig = ranks => {
    const queue = [...ranks];
    Shoe.prototype.draw = function () {
      const rank = queue.shift();
      // Any suit of that rank still in the shoe.
      const card = rank && [0, 1, 2, 3].map(suit => suit * 13 + rank).find(c => this.remainingByCard[c] > 0);
      if (!card) return draw.call(this);
      this.remainingByCard[card] -= 1;
      this.remaining -= 1;
      this.dealt += 1;
      return card;
    };
  };
  console.log('rig ready');
});
