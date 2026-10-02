# Behavior changes from the original apps

The merged app reproduces the original Drills and Games apps unless listed
here. Each entry says what changed and why. Entries marked **fix** correct
behavior that was clearly broken in the original; **merge** entries come from
combining the two apps into one.

## Settings

- **merge** One set of rules, playing-strategy and true-count settings is
  shared by the game and the drills (the game's options were a superset).
  Fresh-install defaults follow the game: double after split on, dealer hits
  soft 17 on, true count rounding "Round". The drills previously defaulted
  to off / off / Floor.
- **merge** Each drill keeps its own options. Values the old Drills app shared
  between drills (decks, timer mode, progressive speed, tray style, tests per
  drill, two counts) are now stored per drill.
- **merge** Sound is a single "Sound" switch, off by default.
- Error logs (the "Log errors", "Auto-delete logs", "Do not keep error logs"
  options and the error log viewer) were removed. The per-hand error tallies
  used by "Drill Errors" hands are kept.

## Strategy and counting

- **fix** True count "Truncate" now truncates toward zero for every value. The
  game turned exact negative counts into the next integer up (-2 became -1).
- **fix** True count "Round" rounds. The drills added 0.5 instead of rounding.
- Strategy file 35 ("Basic High-Low") was never selectable and its file was
  malformed; it is not included.
- **fix** Strategy code *D ("stand with 3 or more cards") checks the number of
  cards in the hand. The game checked a card slot number, so in the game it
  almost always said stand.
- **fix** Loading an "extended" strategy (Double Exposure, Hole Carding) no
  longer resets the saved index range setting; the range is simply not applied
  to those strategies.

## Settings screens

- **fix** Rule constraints now run for every control. The legacy selects on
  Common Rules (and the Playing Strategy rule list) wrote their options
  directly, skipping `DoOpt`, so e.g. turning on "No dealer hole card" left
  dealer peeking on and "Early Surrender vs. 10" left the ten peek on.
- **fix** Choosing something in Unusual Games no longer clears unrelated rules.
  The legacy screen replayed the "off" branches of Double Exposure, Super Fun 21
  and Spanish 21 for every selection, which silently turned off resplit aces,
  multiple draw to split aces, double on any number of cards, double on 3 cards,
  Double Down Rescue, late surrender, the blackjack payout, Diamond BJ 2:1,
  five-or-more-card 21, dealer wins ties and "Player BJ always wins". Selecting a
  game now applies only that game's own rule bundle; leaving a variant restores
  the rules that variant had forced to their defaults.
- **fix** "Double after ace split" turns on "Double down after split"
  immediately. The legacy app only did it when leaving Common Rules, so the
  setting could be left in an impossible state.
- **fix** The second Bonuses list (777 payouts, 5-, 6- and 5-or-more-card 21,
  suited 678, split-ten-plus-ace) works on phones and shows all nine rows. The
  legacy phone layout drew six of them but never bound them, so tapping did
  nothing.
- The dealing-bias selector (Dealer Errs/Biases) is kept as a setting. It had no
  effect in the legacy game because its strength variable was always 0.
- Opening the table (Play Blackjack on the home screen, or Launch Game in
  Settings) no longer changes the saved seat count. The original cut a portrait
  table to two seats and saved that; the table now fits up to four seats in
  portrait on its own. Seat 1 is still freed when every seat in play is a
  computer player.
- Unusual Games asks for the import code in a dialog instead of a text box on
  the screen, which is how the rest of the app prompts for values.
- Imported side-bet games are stored as `{id, name, definition}` under the
  `customSideBetGames` key instead of one `BStrat<id>` key per game, and the
  decoded `BONC*` arrays are no longer persisted: they are derived from the
  definition when needed.

## Strategy, true count, betting and casino screens

Playing Strategy (legacy `frmStrats`)

- An imported strategy can be deleted: the Playing Strategy screen shows a
  "Delete Imported Strategy" button while an imported strategy is selected, and
  deleting one falls back to High-Low. The legacy app could only remove imports
  with Reset Defaults.
- Imported strategy names are shown as text. The legacy app stored the name
  JSON-encoded and displayed it raw, so the list showed `"My Strategy"` with the
  quote characters.
- Settings are saved as they change. The legacy screens only wrote on Back, so
  leaving any other way lost the edits.
- The index range and "Adjust IRC" value are clamped to the schema's range
  (-99..99 and -999..999). The legacy prompts accepted any number.

Strategy table viewer (legacy `frmtabhn`)

- Switching tables resets every cell's colour. The legacy app only reset five
  specific cells, so white text left over from the split or surrender table
  could stay on another table's cells.
- The insurance rule ("Use Insurance Decks Table", "Never Insure", "Red Seven
  Rule", "Use Insurance Hand Table") is shown under the Insurance/Counts
  tables. The legacy app built that label and then always hid it.
- The "Insurance Decks Table" is hidden when the strategy does not use one. The
  legacy app skipped filling it in but left the previous strategy's numbers on
  screen.
- In the Card Point Values table, a card that only counts when it is red shows
  `*` in the Red row and its real value in the Black row. The legacy app wrote
  `*` and left the Black cell blank.
- Specialty plays are collected from the rows the table actually shows. The
  legacy `putspec` scanned all ten rows of every table and wrote symbols into
  rows it had just blanked (no built-in strategy is affected; verified against
  the recorded reference data).
- The grid scrolls sideways for "extended" strategies (Double Exposure, Spanish
  21 style) instead of squeezing 23 columns into the screen, and every row is
  reachable: the legacy grid had a fixed height that cut off the last split row
  on a phone.
- Column headers are rebuilt per strategy. After viewing an extended strategy
  the legacy app relabelled the ten-card column "10" instead of "X" for every
  strategy shown afterwards.
- Shading cells by error count (the legacy's `defineit2 == 3` mode) is a
  "Shade error counts" switch on the screen rather than a separate entry point.
- The screen takes the mask to edit as a parameter, so the same screen serves
  the Custom index set (`strategy.customIndexMask`) and the Flash drill's hand
  picker (`drills.flash.customHands`). Only the custom-index mask ignores the
  index limits while it is edited, which is what the legacy Select button did.

Import Strategy (legacy `frmImport`)

- The downloaded text is checked: it must parse as a strategy file before it is
  stored. The game stored any non-empty response, so a server error page became
  an unusable entry in the strategy list.
- The entered code is shown on the button (as in the game; the drill's version
  wrote to a `<button>`'s `value` and kept showing "Enter text here").
- The download is a normal asynchronous request. The legacy app used a
  synchronous XHR and an `http://qfit.com` retry that is blocked as mixed
  content; the retry is dropped.

True Count Calcs (legacy `frmTC`)

- Nothing beyond the shared true-count fixes listed above; the game's version of
  the screen (with Remaining Cards, allowed estimation error and the two side
  counts) is the one that is kept.

Betting (legacy `frmBet`, `frmBetSelect`)

- The bet table is stored as `betting.ramp` = `{minCount, rows: [{chips, hands}]}`.
  The legacy spread it over `sscntstart`, `bbscntcheat`, `sscntstop`, `scbt[22]`
  and `schd[22]`, plus a derived 21x200 `bbvals` lookup that was persisted; the
  lookup is now computed from the ramp (`settings/bet-ramp.js`).
- Growing the table repeats the last row instead of leaving new rows empty (the
  legacy filled empty rows with one chip the next time the table was drawn).
- The bet-select screen starts on the row's current number of hands; the legacy
  always reset it to one.
- "Minimum bet count" is clamped to -99..99.

Casino Database (legacy `frmDB`, `frmDBDetail`)

- **fix** Load Rules no longer wipes the rules it just set. The legacy handler
  set its defaults and then cleared option indices 1..99, so dealer peeking on a
  ten and on an ace, "Insure then Surrender allowed" and soft 19/20 doubles
  always ended up off. They are now on, as the handler intended.
- **fix** Double after split follows the casino's `ds` code. The legacy handler
  forced it on for every casino, because index 0 was the one index its clearing
  loop missed.
- **fix** `d3` ("double down on the first three cards") maps to "Double down on
  3 cards". The legacy mapped it to "Double any number of cards".
- Dealer hits soft 17 follows the `h17`/`s17` code and is off when neither is
  listed (4 of 1089 live records). This matches what the legacy did in practice.
- Load Rules writes every rule it understands, including the ones it turns off,
  so loading a casino never leaves part of the previous one behind. It then
  reports which casino was loaded; the legacy jumped back to the options hub
  without a word.
- The penetration field is kept as the legacy read it: `cardsBehindCutCard =
  52 x (field / 10)`. The settings spec lists this as a bug ("the number of
  cards dealt, not the number behind the cut card"), but the live CBJN data says
  otherwise - the median value is 1.5 for six decks and 0.8 for two, which is
  only sensible as decks cut off - so the legacy mapping is correct.
- The CBJN id is remembered and shown on its button. The legacy stored it but
  never read it back, so the button reverted to "Enter CBJN id" after a reload.
- Table limits are not loaded from the casino record (as in the legacy); the
  limits setting is a fixed list of ranges that the records do not map onto.
- Rule codes are matched exactly after trimming, so the handful of malformed
  entries in the live data (`rs3.pv`, `h17.ds`, `ds weekends only`) are ignored,
  as they were before.
- A search with no hits says "No games found" instead of showing only the
  "click a game" header (the legacy's no-hits branch was unreachable).
- The database is cached under the `casinoDatabase` storage key as
  `{date, records}` instead of an array whose first element was the date.

## Game table

The table (legacy `frmTable`), its betting overlay (`frmBets`), the bet picker
(`frmBetSelect`) and the statistics screen (`frmStats`).

Pace of play and input

- **fix** Input is refused while an animation is playing. The legacy engine ran a
  round to completion and replayed its drawing from a command queue, but enabled
  the action buttons at logic time; a tap during the replay started a second
  batch over the one still playing (spec quirk 27). The new table queues the
  engine's events and only offers the controls the engine reports as legal once
  the queue is empty. Gestures are ignored the same way.
- **fix** The bankroll label and the count readouts follow the replay, not the
  engine. The legacy panels read the final values, so the bankroll jumped to its
  end-of-round figure while the cards were still being dealt. Stakes now come off
  as they are placed, payouts arrive hand by hand, and the running/true counts
  are refreshed when the last card of a timeline is showing.
- **fix** The mouse "too short" test measures the swipe, not `|x - y|` (quirk 44).
  A swipe shorter than 30 px is a tap; anything longer is read as a direction.
- All three speed settings convert to a pause of `(101 - speed) / 120` seconds.
  The legacy used `/125` for the other-players speed and `/120` for the other two.
- The insurance offer still passes itself after five seconds, as before.

Leaving the table

- **fix** Leaving in the middle of a round hands the chips back (quirk 41). The
  legacy abandoned them: they had already been taken out of the saved bankroll.
- Entering the table does not restart a round in progress, so Stats, the error
  review and the bet editor can be visited mid-hand and come back to the same
  hand. The legacy reset the whole session on re-entry unless a flag was set.

Layout

- Both orientations work at any size. Portrait shows at most four seats (keeping
  the player's own), and the cards shrink so every shown seat fits side by side;
  the legacy forced portrait down to two seats and refused to play otherwise.
  There is no "rotate back" cover screen.
- Cards in a hand always step far enough right to leave each one's rank index
  showing (at least 26 % of the card width). With the legacy spacing a narrow
  portrait seat gave a 3 px step, which hid every rank but the last.
- The canvas is scaled for the device pixel ratio, so the felt and the cards are
  sharp. The legacy sized every canvas's backing store in CSS pixels.
- The discard tray and the shoe are cut out of their photographs with a
  destination-in mask instead of the legacy's `"darker"` plus `"lighter"`
  compositing trick, and the felt behind them comes from the same background
  buffer at the same scale, which removes the mismatched rectangle the legacy
  left around the tray.
- The whole table is redrawn from the replayed state each frame rather than
  erasing rectangles out of a saved background, so there are no stale-pixel
  artifacts and the pointer needs no save-under canvas.
- Action buttons sit in two stacks at the bottom corners in both orientations.
  The legacy moved double/split/surrender under the discard tray in portrait.
- The status band, bankroll, count readout and per-seat chip labels are DOM
  elements positioned from the computed layout, as in the legacy; everything else
  is drawn on the canvas.

Betting

- The bet grid is built from `betting.ramp` (chips x `betting.chipValue`), with
  rows that repeat the row before them collapsed into one tile, the previous bet
  highlighted orange, and the won/lost amount since the last bet in the heading,
  all as the legacy `SquishBets`/`makebuttons49c` did.
- A bet outside the table limits, or one the bankroll cannot cover, is refused
  with a message in the overlay. The legacy did not check the bankroll.
- "Side Bet" opens the bet picker (`game.betSelect`) instead of swapping the
  grid in place. Side bets are **not** placed: the engine does not resolve them
  yet, so the picker reports that and no money is wagered. The legacy switched
  the same grid to side-bet amounts.
- The overlay is a compact panel at the bottom of the felt in both orientations.
  The legacy stretched it over most of the table in landscape.
- Stats is reached from the title bar, where it is also available during play,
  rather than from the overlay.

Dealer errors ("Foul")

- **fix** A caught error refunds exactly what the player was short, and a missed
  one reports that same amount. The legacy refunded an undivided `fixuptot`,
  which overpaid by 2-4x for most error types, while the miss report divided it
  by a per-type factor (quirk 20).
- Six of the eight error types are implemented: insurance mispaid, blackjack
  mispaid, a good hand called a bust, a dealer bust called 21, a winning hand
  paid as a push, and chips taken on a push. Each is applied to the settled round
  as a payout adjustment, so "Busted a good hand" shows at settlement rather than
  at the moment the card was dealt.
- "Dealer stood on 16" and "Bonus not paid" are not implemented: the first needs
  the dealer to stop drawing mid-hand and the second needs side-bet payouts,
  neither of which the engine can be asked for. Their options still turn the Foul
  button on.
- The error chance per type follows the legacy table (0.07 to 0.525). The
  "probability scale" slider the legacy pinned at 50 has no UI, as before.

Statistics

- **fix** The bankroll low/high/average figures are sampled after the round's
  chips have been returned (quirk 37; the sampling lives in the session).
- The screen lists the counts, the bankroll and bet history, play and bet
  accuracy, and the four in-table display switches. The per-category error
  counts, the side-bet accuracy, "Last Bet", "Round # this shoe" and the
  tray/shoe card breakdowns are not shown.

## Side bets

- Side bets are resolved by the engine and paid. The rule engine
  (`game/engine/side-bets.js`) evaluates a game's pay table against the hand,
  pays the first matching tier (or every tier for games that accumulate), and
  returns the stake for a tier that pays nothing.
- The card-pattern codes in the game definitions were derived from the
  published pay tables of the built-in games, not from the earlier reading of
  the original code: 1 is a pair, 2 three of a kind, 3 a straight, 4 a flush,
  5 a straight flush, 6 a suited pair and 7 suited three of a kind. With that
  mapping every built-in game pays its documented tiers.
- Insurance is settled on hands that win through a bonus. The original skipped
  it there (a mistyped function call), leaving the insurance stake on the table.

## Drills

Shared by all four drills

- **fix** The Hands / Tests counter is refreshed after it is incremented, so it
  shows the number of hands or tests given so far. The legacy panels were drawn
  before the increment, so the count lagged a hand behind until the next
  one-second tick, and the accuracy was worked out from the newer number.
- **fix** Progressive Speed also speeds up a run started with Restart. The
  legacy multiplied the speed only on the automatic start after the countdown,
  although its help said otherwise.
- **fix** Timeouts are scored in every drill. In Depth the timer called the
  Flash drill's handler and threw, so nothing happened and no error was counted;
  in Count and Full a timeout showed the answer but did not count as an error.
  All of them now show the answer, buzz and count one error, as the help said.
- **fix** The ace-adjusted bet, play and insurance counts are rounded with the
  true-count rounding rule. The legacy left them unrounded, so the answer sat
  between two cells of the grid and could not be tapped. Divisions are also
  cleared of floating-point dust before rounding, so a count that is exactly a
  whole number is not floored to the one below.
- The error-log screen is gone (see Settings). Errors are still tallied per
  strategy-table cell, which is what "Hands: Drill Errors" needs; the Flash
  options screen has a "Clear error history" action in its place, which only the
  dropped log screen offered.
- The ten-second countdown overlay, the stats grid and the answer grids are DOM
  and canvas elements sized for the device pixel ratio, so they are sharp and
  re-lay-out on rotation without reloading the page. The legacy reloaded the
  whole page when an Apple device was turned to landscape.
- An answer grid is drawn on a canvas that is positioned out of the layout flow,
  so its size never feeds back into the layout that decides how big it should
  be.
- Sound follows the single "Sound" switch. The legacy flag meant the opposite of
  its name (`optsound == true` muted the app).

Flash drills

- **fix** Hands are built from the chosen list every time. On the first drill of
  a session the legacy mis-typed the Hard hit/stand entries of the Default list
  (`UBound` of an empty array), dealing them as soft hands and demanding the
  Soft H/S situation.
- **fix** Face cards appear in all four suits. The legacy only turned a ten into
  a jack, queen or king when it had already drawn the spade ten.
- **fix** A hand only times out in Auto timer mode. The legacy armed the
  per-hand timer in the count-down and count-up modes too, where the setting is
  the total time for the drill, so every hand timed out after the whole drill's
  worth of seconds.
- **fix** "No tests (quick drill)" does not record errors. The legacy advanced
  that mode by letting every hand time out, which counted every hand as an error
  and wrote it into the Drill-Errors tallies.
- **fix** An index-test error is filed against the hand's own table and row. The
  legacy picked the last enabled situation flag and a stale row, so the tally
  landed on an unrelated cell.
- A wrong answer in "Warn on error" mode is explained in a dialog ("Action: X;
  Correct: Y", the dealer card and the player's hand, and the table that
  decides), with a button that opens the strategy table viewer on that table with
  the tested cell marked. The legacy opened the table straight away.
- The "Reserved" count mode (the experimental Wait-button deviation drill) and
  the "Reserved" checkbox, which only changed that button's caption, are
  dropped, as the behavioral spec recommended.
- A drag on the card area must move at least 10 px to count as a swipe. In the
  legacy a plain tap was read as a swipe downwards, i.e. Hit.
- The hand list the Default option uses holds the same 127 hands with the same
  weights, but grouped by dealer upcard instead of interleaved with the other
  situations. The drill picks from it at random, so only its contents matter.

Depth drills

- **fix** One deck at Full resolution is refused at launch (the resolution is
  changed to Half Deck). There is exactly one depth to ask about, which the
  legacy then dropped from the grid, leaving it empty.
- **fix** No two tests in a row share an answer, unless there is only one answer
  to give - with two decks at full resolution the legacy would keep rejecting
  the only test it could show.
- A finished drill reports its accuracy. The legacy cleared the tray and the
  buttons and said nothing.
- A tray style that cannot hold the decks in play is reported and corrected
  before the drill starts, as the legacy did, but the message names the style's
  capacity.
- "Count Range" limits the running count the true-count drills draw, which is
  what the legacy code did; its help described it as a true-count range. A range
  that holds no running count is refused at launch instead of looping forever.
- Depths are written as mixed numbers (`1¼`, `½`). The panel of the TC
  Conversion drill writes a half deck as "½" rather than the legacy's "0½".

Count drills

- **fix** The Ace Bet Count is offered only for a counting system that gives
  aces no value, and the Ace Play and Ace Insure Counts only for one that counts
  them; the other combination is refused at launch. The legacy allowed every
  drill with every system, although its help said otherwise.
- The "Deal Speed 10ths" default is 20 (two seconds), the value the legacy
  slider showed. The settings schema had it at 2 (a fifth of a second).
- The discard-tray card thickness is a Count-drill setting of its own. The
  legacy applied the Depth drill's value to the Count drill's tray.
- A flash that is interrupted by the end-of-shoe warning leaves no canvas
  transform behind (the legacy skipped its `restore()` on that path).

Full table drills

- **fix** The drill runs on a phone in landscape. The legacy refused any screen
  under 799 x 410, which an iPhone 13 in landscape (844 x 390) fails. In portrait
  it now shows a "turn the device sideways" message over the drill, with the
  title bar still usable, instead of a separate cover screen that could only go
  back to the main menu.
- **fix** Two Tables counts each card once, as it is revealed. The legacy
  re-counted every card on show in the third and fourth questions, so the
  expected running count double-counted the cards from the first two.
- **fix** Two Tables deals the seats the Players option asks for. The legacy
  skipped the first seat, so "Six Players" dealt five.
- **fix** Two Tables ends when either shoe drops to twenty cards. The legacy
  tested the second shoe for exactly ten cards left, a count it could step past.
- Two Tables chooses how much of a table to show once per cycle, so the two
  tables are shown the same way; the legacy re-rolled it for each question. The
  second table is drawn on blue felt, which the legacy intended but painted over.
- A round that starts with fewer than three cards left in the shoe is dealt from
  the first seat like any other. The legacy started such a round at the fourth
  seat.
- Scattered cards keep their positions while a round is on screen (they are
  placed from a per-round seed), so a redraw after a rotation does not move them.
- The two dealer mistakes the original could make but this rebuild first left
  out are implemented: standing on a hard 16, and not paying a winning side bet.
  Standing on 16 charges the dealer with the bets of the hands that lost to that
  16, since a dealer who draws from 16 busts more often than not.
