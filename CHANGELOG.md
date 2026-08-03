# THE BONE SIEVE — Changelog

Full history of released builds. The in-game popup shows every release from
the last 15 days, newest first and scrollable; anything older collapses into a
link to the full record. This file is the complete history either way.

> **Note on dates.** `beta.4`, `beta.5` and `beta.6` all shipped 2026-07-28.
> `beta.2` and `beta.3` predate dated releases; 2026-07-27 is inferred from the
> last modification before that day, not a recorded release date. Correct them
> if the real dates are known.

---

## HOW TO UPDATE THIS (read me first)

When you ship a change, update **two** places and keep them in sync:

1. **This file** — add a new `##` section at the top, below this notice. This is
   the full record, including engine detail that never goes on screen.
2. **`index.html`** — the `CHANGELOG` array, found by searching for
   `CHANGELOG — MAINTENANCE NOTE`. **Unshift** a new release object onto the
   front. Do not overwrite it: the in-game popup shows the whole recent history,
   newest first, and scrolls.

Rules:

- Every release needs an `id` and a **`date`** (`YYYY-MM-DD`). Both files should
  carry the same date — this file in the section heading, `index.html` in the
  release object.
- `VERSION.id` is **derived** from `CHANGELOG[0].id`, so the two cannot drift.
  Do not set it by hand. It is the localStorage key that decides whether a
  returning player has already seen this release, so adding a release with a new
  id is what makes the popup reappear. Never reuse an id.
- Version format is `the_bone_sieve_v<major>.<minor>.<patch>_<stage>` — e.g.
  `the_bone_sieve_v1.0.0_beta.2`. The popup prettifies this for display; you do
  not need to hand-write the pretty form.
- Entry `kind` values are `added`, `changed`, `fixed`, `balance`. Each maps to
  its own colour and icon in the popup.
- Keep entries player-facing. "Rebuilt the fog as baked sprites" is engine
  detail; "the crypt runs smoothly on weaker machines" is what a player cares
  about. Put the engine detail in this file, and the player-facing line in the
  game.
- Aim for 4–8 entries per release in the popup. More than that and nobody reads
  it.
- Codenames render in Hellbone, which is **capitals only** — no digits, no
  punctuation. Keep them A–Z and spaces.
- Releases older than `CHANGELOG_WINDOW_DAYS` (15) drop out of the popup
  automatically and collapse into one line pointing at
  `CHANGELOG_HISTORY_URL`. Nothing needs pruning by hand — but that URL should
  point somewhere this file is actually readable.

---

## the_bone_sieve_v1.0.0_beta.10 — "WHAT OUTLIVES THE RITE" · 2026-08-03

> **On the number.** There is no `beta.9`. This release jumps from `beta.8` to
> `beta.10` deliberately — it is the largest change the game has had, and the
> number is rounded up to say so.

*The game gets a second ledger. Everything up to now has been about one descent;
this release is about what a player carries between them — a currency earned by
going deep, a career screen to spend it in, permanent upgrades, and a set of
locks that turn the whole existing content table into something earned rather
than something handed over on the first run.*

**Returning players start smaller.** There is no migration path for this and
there deliberately isn't one: a save that has never held a Marrow ledger reads
as a fresh career, so anyone already playing will find the counter offering the
bone die and seven tier-1 relics and nothing else. That is the intended shape —
the gating exists so the content arrives over a career instead of all at once —
but it will read as a loss to anyone who was mid-run on the old build, and it is
called out on screen for that reason.

### Added

- **Marrow, and the ledger that holds it.** A second persistent store,
  `boneSieveMeta`, kept apart from the audio/detail/view preference keys because
  those are preferences and this is a career. Load, save, repair and reset all
  treat what comes off disk as untrusted input: numbers clamped, ids validated
  for shape, unknown keys dropped, corrupt saves falling back to a fresh ledger
  rather than refusing to boot. Unlock ids are deliberately **not** validated
  against the live content tables, so a story-generated die cannot be silently
  deleted by a table that has not heard of it yet.
- **The earn formula.** `marrowFor(level, blood, bestOffering, priorDeepest)` —
  `level × 3` uncapped, `min(60, √blood / 10)`, `min(20, bestOffering / 1000)`,
  and a one-time `+50` the run a player beats their lifetime deepest. Depth is
  linear and uncapped while blood and best-offering are compressed and capped,
  because depth is the thing the system exists to reward and raw blood would
  otherwise drown it. Paid in `gameOver()`, once, guarded by a flag on the run
  state. The death screen shows the payout and its working as its own band
  rather than a seventh stat slab — the six slabs are what the run lost, this is
  what it kept.
- **The Archive.** A career screen off the title menu: every die, chalk and relic
  in the game as a uniform tile, grouped by nothing and filtered by everything.
  Two tabs (roster and Oaths) over one ledger bar, since both spend one purse.
  Filters for group and state plus a name search, and a fixed-height panel with
  exactly one scrolling region so the purse and the filters can never scroll
  away. Purchases are confirmed before they are spent, because this is permanent
  spend rather than a run-scoped shop pick.
- **The Oaths** (design §3, restructured from the original "small one-time
  purchases"). Four ladders bought a rung at a time: `+1` bone in the opening
  cup and `+1` re-roll on every cast cap at 3 rungs, `−1` shard on the Ossuary's
  re-roll cost and `+3` opening shards cap at 5. Levels stack. Progression is
  strict — `riteNextLevel()` only ever offers the rung above the one already
  paid for, so a full purse cannot skip. The re-roll discount floors at 2 rather
  than 1 so `Skeleton Key`, which reaches a flat 1 *and* lays out a fifth ware,
  stays strictly the better thing.
- **Loadout toggles** (design §11). Any owned item can be set aside and brought
  back, free and instantly, with no confirmation — the ceremony around a
  purchase exists because Marrow is permanent, and a reversible choice that
  costs nothing should not wear it. Stored as sparse off-lists rather than a
  flag per item, so they cannot drift out of sync as content is added.
- **Story-gate scaffold** (design §12, shape only). A third card state that
  shows a silhouette, `???`, redacted rule text and no price at all — visibly
  not a dimmer "locked", because "waiting on the story" and "could save up for
  this" must never be confused. `storyBeatsFired` and `storyComplete` have been
  reserved on the ledger since the first phase and remain unwritten. No
  death-generated dice, no story items, no trigger logic: that is a content pass
  and it is not scheduled.
- **`SCOUR THE ARCHIVE`.** A save wipe in the Veil, behind its own dialog rather
  than the arm-then-confirm pattern beside it — arming in place is two clicks on
  one spot, which a double-click satisfies alone. Fine for forfeiting a run, not
  for erasing a career. It counts out what is at stake and resets to a state
  byte-identical to a never-played save.

### Changed

- **Content is gated.** `runShopPool()` derives the per-run catalogue from
  `SHOP_POOL` and is snapshotted into `S.wares` when a run is born, so a toggle
  flipped or an unlock bought between runs can never change what the Ossuary is
  already holding. A fresh ledger opens with the `bone` die and the seven tier-1
  relics. The Grimoire reads the same snapshot, so the book and the counter
  cannot disagree.
- **Depth gates.** Tier-3 content requires having reached descent 15 once,
  tier-4 descent 25, layered *on top of* the Marrow cost. Marrow is earned at
  any depth; the deep content needs a one-time key as well, so a shallow grinder
  can stockpile and still not buy the top of the game.
- **The title screen, the Archive and the Veil rebuilt.** One panel language
  across the game. The menu's nav buttons stop clearing the carved-stone
  material with `!important` and are cut slabs with broken corners; the entrance
  animation drops from 1.2s to under 0.5s because the menu is returned to
  constantly. Settings moves to a labelled corner control that answers `ESC`.
  The Grimoire leaves the title screen — it describes a run in progress and
  there is no run at the menu. `THE RITE` becomes `HOW TO PLAY`, since a *rite*
  is what this game calls a run and the one item a lost player needs was named
  after something else.
- **One close button** across the whole game, drawn with a Hellbone capital `X`
  rather than the icon set's glyph, which does not fill its own viewBox evenly
  and sat visibly high and left however the button was centred. Visible
  scrollbars removed everywhere; the scrolling is untouched.
- **The ornamental frame is off the workbenches.** It overhangs its box by 18px
  and is a reveal; the Veil, the Archive and How To Play are workbenches.

### Balance

- **Chalks are gated too.** They were exempt on the theory that they were board
  garnish. Playtesting killed that: a fresh save with no relic support was still
  reaching descent 20+ on stacked chalk alone, because a chalk multiplies a
  conduit that a deepened chalk then multiplies again. That is not a garnish on
  a build, it *is* a build.
- **`Deepen the Sigil` moves from tier 2 to tier 4**, 22 → 30 shards. It is the
  one ware in the game with no ceiling — it can be bought again and again
  against the same line. Moving the tier raises its cost, moves it onto the
  tier-4 rarity curve so it surfaces late and rarely, and puts its unlock behind
  descent 25.
- **`DEEP CHALK` is withheld when no line can exist that descent.** A boon is a
  forced one-of-three at a Trial rather than a purchase that can be declined, so
  a guaranteed-dead card there quietly costs a third of the reward.

### Known and deliberately unresolved

- **Pricing is a placeholder.** Marrow prices are shard price × 3; the Oath
  ladders are hand-set. A headless career simulator (`tools/sim/career.js`)
  playing whole careers against the shipped model puts a full Archive at 36–80
  runs for strong play, against design §6's 15–25 target. Not tuned in this
  release — the data exists now and the numbers are a separate pass.
- **`tierWeight()` under-serves tier 4.** Against the pool it draws from, the
  counter offers tier 4 at roughly a third of its share. Simulation shows the
  loadout toggles close most of that gap without touching the curve, which
  makes it as much a discoverability question as a balance one.

### Tooling

- `tools/test/` — ten harnesses, 593 assertions, driving the real code and the
  real markup out of `index.html` rather than a second model of it. Includes a
  jsdom pass that loads the real stylesheet and asserts computed style, added
  after a bug where tab panes were switched with a class no CSS rule matched and
  every `classList` assertion passed while both tabs rendered on top of each
  other.
- `tools/test/shoot.js` — drives the installed Chrome through puppeteer-core to
  screenshot the real game and report whether panels fit, whether the page
  scrolls when it should not, and whether tiles are a uniform size. Three
  releases were shipped claiming layout was unverified "because there is no
  browser in the dev environment". There was.
- `tools/sim/career.js` — the career simulator described above.

---

## the_bone_sieve_v1.0.0_beta.8 — "WHAT THE DEEP OWES" · 2026-07-30

*A balance release, driven by roughly 40,000 simulated runs against the shipped
model. Boons stop being relics in disguise, RUN conduits stop being dead
content, and the quota curve stops outrunning every offering a player can build.*

### Added
- **Boons are a system.** `BOONS` — 23 entries across four tiers, gated by `min`
  descent. `S.boons` is a flat list of ids and **every** effect is derived from
  it through one helper apiece (`boonMult`, `boonCasts`, `boonRerolls`,
  `boonTypeBonus`, `boonConduitFlat`, `boonCluster`, `boonChalk`, `boonAlms`,
  `boonRareScale`, `boonQuotaScale`, `boonTrialSoften`, `boonRunGap`). The five
  loose `bonusX` counters that used to live on the state are gone; they were
  written only by the old boon screen and read from five different formulas,
  which is how a boon granting altar slots ended up fighting the altar.
  `maxPool()` and `altarSlots()` deliberately carry **no** boon term — the cup
  and the altar are the two scarcities the build decision rests on.
- **Depth-scaled offers.** `boonTierBias(level)` walks the sieve's taste from
  tier 1 to tier 4 across a run. The weight is asymmetric on purpose: sitting
  *above* the current bias is merely unlikely, sitting *below* it is close to
  disqualifying, because a tier-1 favour at descent 30 is a wasted card. Measured
  offer mix moves from 100% tier 1 at L5 to 11/13/22/54% at L30. Cards carry a
  `tier1`..`tier4` class so the escalation is legible on screen.
- **Boon panel.** Sidebar, below the dice pool, in gold rather than the altar's
  violet — a boon is granted, not bound, and cannot be banished. One chip per
  distinct boon with a stack count in the corner. `flex:1 0 auto` so it fills the
  space the dice panel gave back but can never shrink below its own chips.
- **`w` draw-weight on trials.** `pickTrial()` is weighted; the unseen-first
  rotation is unchanged.

### Changed
- **Exchange messaging, four surfaces.** The card note, both shop hints, the
  action button and the modal heading and hint. `EXCHANGE` was doing the work as
  a *noun* — a place, not an act — and "your altar is full" read as a refusal.
  Now `TRADE FOR IT`, and every line says the same thing in the same order: you
  can still take it, and here is how. Retest showed a player who uses the
  Exchange clears L20 at 67% against 12% for one who never does; it is the single
  largest performance factor measured in the game, and nothing on screen said so.
- **RUN conduits.** Base `typeMult` 4 → 7 (Ossuary Ladder 6 → 10) plus a
  run-only length escalator (`RUN_LENGTH_STEP = 1.0`) applied on top of the
  cluster bonus. A 3-long straight goes 30 → 53, a 6-long 168 → 1,176. The
  formation rule is **untouched** — measurement showed 88–91% of eligible
  clusters fail on a repeated value, not on gaps, and resolving runs on subsets
  the way KIND and PARITY are resolved would have pushed them from ~5% of boards
  to 17–24%, making them a third reliable strategy rather than a jackpot.
- **Iron Rungs** grants gap tolerance: `gaps <= wilds + boonRunGap()`. The only
  lever in the game that moves how *often* a straight forms rather than what it
  pays. One copy takes RUN incidence 5.2% → 7.7%, two → 10.1%.

### Balance
- **The quota curve.** `QG_FLOOR` 1.288 → 1.252, `QG_SPAN` 0.14 → 0.176.
  `FLOOR + SPAN` is preserved at 1.428 so the first level's growth is bit-identical
  and the opening descents do not move. The floor is the whole late game: at
  1.288 the quota outran offering multipliers (which grow nearer 1.07/level) by
  about 1.2× per descent, and the deficit compounded until L25 killed four runs
  in five. L25 clear rate 23.7% → 41.3%; L30 7.2% → 20.0%; ordinary-vs-trial
  gap holds at 29pt so the spike is still felt; 0% of runs reach L45, so runs
  still end.
- **Trial swell cap** 0.23 → 0.13 (x1.45 → x1.35 maximum). Measured in isolation
  this moves L25 by ~1.5 points — by that depth the base curve is what has run
  away, not the spike. Capped anyway so a deep trial never drifts further from
  its ordinary neighbours than a shallow one does.
- **Even/Odd Hand** `min` 15 → 20, `w` 0.3. They were killing 9.2% of all runs,
  roughly 5× the mildest trial, as an unretuned side effect of the beta.7-era
  correctness fix that made Thorn dice and the rare board-wide bonuses respect
  them. Behaviour is unchanged; they now kill 3.1% of runs. Conditional fatality
  is *higher* (they only land deep now) — deliberately.
- **Ninefold Gift** 40 → 20 blood/conduit (power 12.61 → 9.49 by forced-grant
  A/B; it was outperforming every tier-4). **Marrow Gift** 10 → 6 — same
  mechanic, tier 1, and tuning one without the other would have left a tier-1
  and a tier-3 nearly equal. **Sovereign Blood** −18% → −26% quota (5.86 → 7.70;
  it was the weakest tier-4 by a wide margin). **Iron Rungs** 0.30 → 1.87 via the
  gap-tolerance rework; its mean-depth score stays modest by design, but p99 of
  the biggest single conduit on a board goes 704 → 1,706 at two stacks.
- **Shard interest.** `Math.min(5, floor(shards/8))` →
  `if (shards < 70) Math.min(4, floor(shards/12))`. The term paid *more* the less
  you spent, on a purse that had nowhere to go once the altar and cup capped.
  Purse at L20 133 → 111 shards (7.8× → 6.5× the mean ware price); the early game,
  where shards genuinely constrain, is untouched.

### Notes for the next session
- Tier means after tuning: t1 3.73 · t2 3.94 · t3 5.89 · t4 8.93. **Tiers 1 and
  2 remain statistically indistinguishable** — not addressed here.
- Trial clear rates at L5–L20 are now flat (88/83/84/82%) where they used to
  escalate. The escalation moved to L25/L30 and to the ordinary levels
  (L21 98% → L29 72%). If early trials should ramp again, the lever is the trial
  *rules* getting harsher with depth, not the quota.
- Tier-4 boons gate at `min:25`, which only ~41% of runs that reach L25 clear —
  they remain the least-seen content in the game.

---

## the_bone_sieve_v1.0.0_beta.7 — "THE RITE PUTS ON ITS FACE" · 2026-07-29

*A visual pass over every surface the player touches: one blood material, one
button material, the three big overlays brought up to the Ossuary's standard,
and the Veil turned into somewhere you can actually set things.*

### Added
- **Typeface choice.** Pirata One, Metal Mania, Pixelify Sans, Sixtyfour or the
  default, repointing `--font-ui` and `--font-mono`. `--font-display`
  (Hellbone) is deliberately untouched — it is the game's signature and has no
  lowercase, digits or punctuation to fall back on. The four Google families are
  fetched by an injected `<link>` after boot rather than through the blocking
  `@import` at the head of the stylesheet; four extra families in the critical
  path delayed first paint for a setting most players never change. Each option
  previews in its own face.
- **Text size, in pixels.** 13–21px, where 16 is the size the game was drawn at.
  Implemented as `zoom` on each fixed UI root, because every size in the
  stylesheet is an absolute px value and there is no root font-size to multiply.
  The canvas is excluded — it derives its backing store from `innerWidth` and
  converts pointer coordinates by hand, so zooming it would desync both. Instead
  the sidebar's scaled width is written back into `SIDEBAR_W`, which stopped
  being a `const` for this reason, so `layoutBoard()` still knows where the board
  may draw.
- **The soul pull.** The title screen's backdrop: ~200 motes in polar coords
  spiralling toward a mark behind the logo, winding faster and burning violet to
  crimson as they fall, cut off before they reach the text. Trails are three
  samples of the path just flown, so they curve with the spiral — a single chord
  read as a scattered tick mark. Count is tiered off `Perf`.

### Changed
- **One blood material.** Four soft elliptical smears — two bright, two clotted —
  tiled at widths sharing no common factor (210/170/260/130) and drifting in
  opposing directions, so the overlaps thicken and thin without a visible period.
  Every smear is centred at 50% with radius ≤50% so it reaches zero alpha inside
  its own tile; off-centre smears were clipped at the tile edge and left a hard
  vertical seam repeating across the bar. Colours are RGB triplets, not hex, so
  the churn layers fade to their own colour at zero alpha rather than to
  transparent *black*, which had been leaving grey halos. The quota bar and the
  red buttons share the machine; `.met` just repaints it green.
- **Buttons.** Two materials on one silhouette: carved stone (retinted through
  `--btn-a/b/c/--btn-edge/--btn-rim`) for neutral, ghost, neon and gold; blood
  for `.primary`, `.danger`, `#btnConfirm.swap` and `#btnSwapConfirm`. Radiused,
  extruded on a hard bottom edge so pressing actually shortens the block. The
  `.7s` white sweep on hover is deleted. `button.danger` no longer reuses
  `warnPulse`, which rewrote `box-shadow` wholesale and flattened the stone —
  `dangerPulse` restates the block and pulses a glow past it.
- **The boon screen** now carries the bone frame, a masked gold ray fan (finer
  and fainter than Quota Sated's, because this panel is nearly twice as wide and
  at 18 spokes only the ends cleared it, reading as a few hard beams), a bloom,
  and a staged entrance. `claimBoon()` flares the taken card and drops the rest.
- **The death screen** is its inverse: a contracting maw rather than a fan, and
  the run in six slabs on a fixed three-column grid — `auto-fit` packed five onto
  the first row and orphaned the sixth.
- **The Veil.** Bone frame at a smaller `--bfe` (the ornament's padding alone was
  pushing the buttons off a 1050px screen), split into SOUND and SIGHT, each with
  a line of copy explaining its controls. Every channel shows the same speaker,
  struck through when muted, replacing per-group emblems that named the channel
  but never suggested they were clickable. Volumes are real `<input>`s. The
  typeface list opens upward — downward it was cut in half by `#veilBody`'s
  overflow. The sigil above the title is gone; it was only buying vertical space
  the controls needed.
- **Detail owns the miasma.** The MIASMA slider is removed and `setFogForTier()`
  derives `fogAmt` from the tier, including at boot — the two controls used to
  disagree, since dropping to LOW thinned the fog while the slider still read
  100.
- `.menuBtnRow` is `align-items:stretch`, so a `.ghost` beside a `.big` no longer
  renders at two different heights (the death screen and the Veil both showed it).
- The title screen's Phosphor pentagram is replaced by `assets/img/penta.png`,
  sized as a crest with its own breathing bloom, and the screen now assembles
  itself in sequence. The nav's entrance uses `backwards`, not `both` — a filled
  animation keeps applying its final transform and would beat
  `.menuItem:hover`'s translate.

### Fixed
- **The stranded quota-bar wash.** `#quotaBarOuter.surge::after` had no
  `animation-fill-mode`, so when the 0.55s sweep ended the pseudo-element
  reverted to its own base style — which declares no opacity, i.e. fully opaque.
  `.surge` was meanwhile never removed (`syncUI` only ever took it off to
  re-add it), so the sweep sat across the bar for the rest of the run. This is
  the "metallic sheen" reported since beta.6: white originally, and a green film
  over the next level's red once the sweep was recoloured. Fixed with `forwards`
  plus explicit removal on a timer and whenever the quota is not met.
- **The Ossuary's button row.** The action button lived in its own block above
  the row, so filling the altar made it appear and shove NEW WARES and DESCEND
  down under the carved border. All three now share one row permanently and only
  the middle button changes face; the hint above reserves two lines' height so
  wrapping cannot shift anything either. `setShopAction()` gates the wake
  animation on the state genuinely changing, since `renderShop` runs on every
  click and the button otherwise twitched continuously while browsing.
- **The Exchange list** is built once per opening by `buildSwapList()` instead of
  being torn down inside `renderSwap()`; picking and un-picking replayed every
  row's staggered `rowIn` and flickered the whole column.
- **Viewport units inside zoomed subtrees.** `vh`/`vw` resolve against the real
  viewport and are *then* multiplied by `zoom`, so an uncorrected
  `max-height:94vh` rendered at 94vh × scale and hung off the bottom of the
  screen at larger text sizes. Every such cap inside a zoomed root is now divided
  by `--ui-scale`. `#settingsOverlay` is exempted from the zoom entirely: it
  holds the control that sets the value, and scaling it made the panel grow out
  from under the pointer as you used it.

---

## the_bone_sieve_v1.0.0_beta.6 — "THE CRYPT ANSWERS" · 2026-07-28

*A feedback pass: one ash-and-ember language across the board and the HUD.*

### Added
- **Ash.** One shared particle vocabulary for the board — matte flecks carry the
  weight, a few embers carry the light. Bones landing, bones snatched back and
  omens falling all speak it, so the pass reads as one language rather than
  nine separate effects. The sidebar's half is DOM embers, since canvas
  particles would sit behind the HUD.
- **The descent is its own beat.** A curtain wipes down over the board, the
  floor is swapped behind it, and it lifts on the new one — streaks rushing
  upward the whole time, because you are going down past them.
- **Decrees announce themselves.** Carved permanently into the rite, so they
  land colder and heavier than a Trial: violet-black rather than crimson, a slab
  of dark pressing in from the top, ash falling *through* the announce rather
  than bursting up from it.
- **Trials and decrees are readable long after the announce** — hover any tag on
  the strip for what it does and whether it lifts.
- Four voices: `snatch` (a re-roll, scraped inward — the reverse of a cast, so
  it never sounds like a fresh throw), `quotaMet` (a swell resolving onto one
  bell; the sieve stops asking rather than a fanfare), `socket` (stone on stone,
  then the bind), `decree` (low, slow, and it does not resolve).

### Changed
- Dice landing is dust and grit now, not a ring: a low dust ring, flecks thrown
  out along the floor, and a couple of embers kicked up off the impact.
- Re-rolling reads as an implosion — ash drags inward to where each bone sat and
  a violet ring closes over the empty tile, before they are flung again.
- Meeting the quota overloads the bar: a white wash across it, the border flares
  and embers come off the panel.
- A big bank punches the blood counter, scaled against the quota so it means the
  same thing at every depth. A trickle stays quiet.
- Binding a relic slams it into its socket with a ring and a flare of embers.
- **Removed the game title and subtitle from the sidebar.** They were a second
  copy of the menu's, and the space now goes to the panels — the dice pool in
  particular has room to breathe.

### Engine notes (not shown in game)
- `addAsh` is the shared canvas system — matte flecks plus a glow pass that
  reuses the already-baked `emberSprite`, so embers are a blit rather than a
  gradient. Hard cap 190, scaled down on the lower quality tiers. Matte flecks
  fake their tumble by oscillating width off the spin, which costs nothing; a
  real rotation would need a transform per particle.
- `burstEmbers` is the DOM half, on one shared keyframe with self-removing
  spans, capped at 40. Canvas particles cannot serve the HUD beats because the
  sidebar draws over the board.
- The sidebar beats fire off transitions, not state, so they land once each:
  `_metShown` guards the quota surge against every `syncUI`, and the score punch
  is gated on the delta as a fraction of the quota.
- A decree is carved the instant a deep Trial breaks — which is mid-reveal on the
  Quota Sated screen. It is queued and flushed on the descent it actually bites
  into, and waits behind a Trial announce rather than talking over it.
- `descend` holds the level swap 230ms so it happens behind a closed curtain; the
  state transition itself is unchanged.
- The descent streaks were building nested `<i>` elements from an unclosed tag,
  so all 26 stacked inside one another and only the outermost was visible.
- Measured at 4× CPU throttle: idle, a full cast with every die landing, an
  all-dice re-roll, ash flooded past the cap, the decree announce and the descent
  transition all hold a 16.7ms median with zero dropped frames.

---

## the_bone_sieve_v1.0.0_beta.5 — "THE MERCHANT LAYS OUT ITS WARES" · 2026-07-28

*The Ossuary rebuilt around trading-card wares, and a reusable ornamental frame.*

### Added
- **`assets/` directory.** First real asset layout: `assets/fonts/` and
  `assets/img/`, with `assets/README.md` documenting the convention and how the
  border pieces were measured and cut. `Hellbone.otf` moved out of the project
  root into `assets/fonts/`; `index.html` is now the only file at the root.
- **Ornamental border (`.boneFrame`).** Skulls, scrollwork and pentagram
  medallions from a painted asset, framing **both** the Ossuary and the Quota
  Sated box. Deliberately **not** screen-specific: drop
  `<div class="boneFrame"></div>` into any `position:relative` box and
  `buildBoneFrames()` fills in the eight pieces.
- Wares are playing-card shaped, with a rarity ribbon, a price pill, a nebula
  churning behind the glass, ash motes lifting through the window, and a
  summoning ring turning behind the relic on the top two tiers.
- Gilt filigree on the rim of Rare and Cursed wares — a second, card-scale
  nine-slice of the same acanthus motif.
- Cards react to the pointer (and to touch): the card leans toward the cursor,
  the icon stands forward of its frame and parallaxes against it, and the glass
  over the icon window carries a specular that tracks the pointer.
- Rare and Cursed wares carry a holographic foil sheen that sweeps as the
  pointer crosses them. Cursed wares also idle with a slow crimson pulse.

### Changed
- Shop wares are now large trading-style cards: icon behind glass in a recessed
  window, then type, name, description and price.
- Rarity is a deliberate ladder rather than a border colour. Each rung adds a
  layer and Cursed gets the lot:

  | tier | rim | nebula | motes | ring | foil | rim art |
  |---|---|---|---|---|---|---|
  | Common | grey | — | 0 | — | — | — |
  | Uncommon | steel | .5 | 3 | — | — | inset rule |
  | Rare | gold | .6 | 6 | yes | yes | filigree |
  | Cursed | crimson | .78 | 9 | yes | yes | filigree + pulse |
- Ossuary layout reworked: purse and run standing merged into one ledger bar,
  full-screen centred modal, larger card grid, the whole panel framed.
- Fixed the confirm hint reading "seal the bargain for the The Ouroboros".

- **The Exchange.** A screen of its own, opened from the Ossuary when the cup or
  the altar is full: the ware you are taking on the left, everything you hold on
  the right with hover tooltips, pick one and seal the trade. Deliberately built
  in the plain panel language — the carved border belongs to the Ossuary and the
  rite, and a third one here would fight them.
- **Removed: clicking bones and relics on the sidebar to destroy them.** That
  flow only ever existed to make room, and it required lifting the sidebar above
  the shop overlay (`#sidebar.shopMode{z-index:60}`), which is what left the
  Ossuary half-covered. The sidebar now sits under every overlay, so the Ossuary
  is never obscured and nothing behind it is clickable.
- Being full no longer greys a ware out — only the purse does. A full cup or
  altar swaps the CONFIRM button for EXCHANGE at the same price, and the card
  note says what the trade would cost you.
- The trade is checked before anything is destroyed: an unaffordable purchase
  after the old item was already gone would have cost the player both. Verified
  a die trade (pool stays at cap, price paid, ware bound), a relic trade (the
  chosen relic leaves, the new one binds), cancel leaving state untouched, and
  an unaffordable trade refusing to open.
- `S.shatterSel` / `S.relicSel`, `#btnShatter`, `#btnBanish` and their hints are
  gone, along with the sidebar's shop-mode selection styling.

### Engine notes (not shown in game)
- **Placed pieces, not `border-image`.** Two runs at `border-image` both produced
  squashed corners and elliptical medallions: it scales each corner to whatever
  `border-width` the box has, so two panels of different proportions each got
  their own uneven scaling. The border is now a corner piece dropped in at a
  fixed size and an edge piece repeated at its painted size — nothing is ever
  scaled to fit a box. Verified: all eight corners render 152×152 on both
  screens, edge tiles locked to native size.
- **The pieces were cut by measurement.** The top band is mirror-symmetric about
  x=360 (asymmetry across 200 columns: 17, under a tenth of a pixel each). The
  skulls sit at x=250 and x=470, so the edge tile is cut between those two
  centres: each repeat joins two half skulls into a whole one, and being centred
  on the symmetry axis the tile is itself symmetric, so the seam matches. Corner
  crop is 152px, past the ~140px cluster. Cut by `tools/crop-border-pieces.js`,
  which is committed alongside the pieces.
- **The frame overhangs its panel by 18px.** The corner art only turns solid
  about 14px in from its own edge, so at inset 0 the panel's square corner showed
  past the ornament's curved silhouette. Measured, not guessed.
- **`--bfe` is the only sizing knob**; `--bfc` derives from it at the corner's
  native 152/104 ratio, so corner and edge always scale together and any change
  is a uniform scale. The small-window breakpoint uses that to step the whole
  ornament down without distorting it.
- Both screens now fill and centre on the **whole viewport** rather than the
  board area — `--stage-off` and the sidebar gutter are gone from both. The
  Ossuary grew to `min(1560px, 94vw)`, leaving room for more wares later.
- Card grid min track 196→184 (160 under the breakpoint) so four wares still sit
  on one row at every size tested, 1920×1080 down to 900×640.
- Replacing the previous generated SVG frame with the painted asset removed a
  74KB data URI: `index.html` went 442KB → 370KB.
- The frame lives on `.modal` while `#shopBody` scrolls inside it, so the
  ornament never scrolls away or gets clipped by the scroll container. It is
  `pointer-events:none` — verified it does not hit-test.
- One delegated `pointermove` handler on `#shopCards` writes four custom
  properties (`--px/--py/--tx/--ty`) on the hovered card, rAF-batched. Tilt,
  glass, icon parallax and foil all read from those, so a frame of movement is
  one style write and a composite. The host card never moves, so its rect is
  cached for the hover instead of measured per frame.
- The foil is masked to the card's upper half: a dodge-blended sheen dragged
  over body copy makes the description unreadable.
- **Reactive layers translate; they do not restyle their gradients.** Driving
  gradient *stop positions* from the pointer repaints the layer every frame —
  that alone halved the frame rate on a hover sweep. Both the glass and the
  foil are now fixed gradients on oversized child layers that get translated,
  which the compositor handles for free.
- `.cEtch` carries a standing `will-change:transform`. Without it the SVG
  border-image was re-rastered on every frame of the card's rotation, which
  bisecting showed was the single largest remaining cost.
- Card rects are measured for the whole rack at once and cached. Measuring
  lazily per card-enter forced a synchronous layout mid-sweep, exactly when the
  pointer is moving fastest.
- `.cInner` holds its promoted layer rather than toggling `will-change` on
  hover; building and tearing down a card-sized layer per enter spiked
  precisely when crossing between cards.
- Cards use `min-height` plus grid `align-items:stretch`, not `aspect-ratio`
  alone — a long description made one card taller than its neighbours.
- The Cursed pulse is on its own `::after` layer. Animating `.cInner`'s
  box-shadow outranked the hover and selected glows, which are box-shadows on
  the same element.
- Card grid min-track is 190px — the widest that still fits the usual four wares
  on one row at 1400px. Five (Skeleton Key) wrap, which stays balanced.
- Measured with 4 cards carrying a turning ring, a drifting nebula, up to nine
  motes, a dodge-blended foil, a screen-blended glass, an SVG filigree rim and a
  pulsing aura. Unthrottled: flat 16.7ms, zero dropped frames, idle and
  sweeping. At 4× CPU throttle: idle is flat with zero drops; a synthetic
  max-rate pointer sweep holds a 16.7ms median with occasional single-frame
  drops (worst frame 33ms — one frame skipped, never a stall).
- `TIER_CLASS` removed; cards now style themselves from a `tier1`..`tier4` class.

---

## the_bone_sieve_v1.0.0_beta.4 — "THE SEAL SLAMS DOWN" · 2026-07-28

*The level-clear reveal rebuilt from a notice into a rite.*

### Changed
- **The "QUOTA SATED" screen is a staged sequence rather than a static plaque.**
  Scrim flash → pentagram stamps down and ignites → title burns in → subtitle →
  carved tablets rise and count up. Beats at 0 / 240 / 430 / 770 / 950 ms.
- The seal is a real pentagram that catches violet fire (`--neon-p`, the same
  accent already carrying the Offering Multiplier and the other mystical UI —
  no new meaning introduced for purple).
- `QUOTA SATED` burns in from an ember-violet ghost to the gold face.
- The two plain reward rows are now three carved stone tablets that rise on a
  stagger and count up. Blood spilled joins shards and next depth.
- **The reveal no longer auto-advances.** It ends on an `ENTER THE OSSUARY` /
  `CLAIM YOUR BOON` button (Space or Enter also work) and holds until the player
  presses it, so the tally can actually be read. Auto-hide removed entirely.
- Pacing stretched now that nothing is racing a timer: tallies count over
  1200 ms (was ~600 ms), tablets stagger 180 ms, button lands at ~2760 ms.

### Added
- `sealStamp` — the seal landing: a dry stone impact, then the fire catching on
  it as a rising breath under two bells.
- `sealCount` — a small chisel tick as a tally climbs, six per tablet, pitched
  up as it goes. Sits on the `ui` bus so it mutes with the rest of the UI.

### Engine notes (not shown in game)
- Fire is SVG strokes, not a sprite: a blurred bloom stroke, a bright core, and
  two short dash patterns chased round the paths by `stroke-dashoffset`
  (`pathLength="100"` normalises the dash units; patterns divide 100 exactly so
  the loop has no seam). Bloom blur is held under 5px so 3σ stays inside the
  default SVG filter region and the halo is not clipped at the bounding box.
- The title burn is two stacked layers cross-fading on opacity, not an animated
  `text-shadow` — animating a 90px shadow on 100px type repaints badly.
- Ember sparks are the one new particle behaviour. They are DOM spans on a
  single shared keyframe rather than canvas particles, because the seal sits
  above the scrim and canvas embers would be washed out behind it. Flat squares,
  no shadows or gradients, self-removing on `animationend`, capped at 26
  concurrent. No per-frame JS.
- Canvas `addRing`/`addShards` usage extended rather than replaced; both bursts
  now fire on the impact beat instead of at overlay-show.
- Every timer the sequence schedules is tracked so quitting mid-reveal cancels
  cleanly (`hideClearFx`), including the pending continuation.
- `onQuotaSated` no longer schedules `openShop`/`openBoon`; it hands the
  continuation to `showClearFx`, which the button invokes. Same call under the
  same conditions, just player-driven.
- Count ticks are scheduled against the inverse of `setNum`'s ease-out
  (`k = 1-(1-p)^⅓`) so they land on equal steps of the *value*, not of time —
  evenly spaced ticks drift audibly away from the digits.
- The button's entrance animation is on a wrapper, not the button: a `both`-fill
  animation on the button itself outranks `:hover`/`:active` transforms and
  would kill its press feel.
- `#toastWrap` raised 28 → 46. The reveal now waits on the player, so a DECREE
  toast at z-28 would have sat behind it unseen.
- `.rays` and `.glowdisc` resolve `left:50%` against the viewport while the
  plaque centres in the play area, so their hub sat 188px left of the seal. Now
  offset by `--stage-off`, which the existing 1100px breakpoint zeroes along
  with the sidebar gutter.
- Measured at 4× CPU throttle: first reveal of a session costs one ~300ms
  first-paint hitch (Hellbone rasterisation, conic-gradient texture, filter
  layers); every reveal after is a flat 16.7ms with zero dropped frames.

---

## the_bone_sieve_v1.0.0_beta.3 — "ONE VOICE" · 2026-07-27

*Audio cohesion pass, cold-die legibility, and the changelog system itself.*

### Added
- The dirge quickens during a Trial (+9% tempo) and on the final cast (+13%),
  stacking to +22%. Ramps over ~3 seconds so it is felt, not switched.
- In-game changelog popup — appears once per release, reopenable from the
  version stamp on the title screen or the CHANGELOG menu entry.
- Studio mark on the title screen: "A SALED LABS RITE", linking to
  https://github.com/KingSaled

### Changed
- **All seven movements rebuilt around one shared palette.** Drums, bass and
  pads now use identical levels across every track; character comes from
  harmony, register and pattern instead of raw volume.
- Cold (non-scoring) dice are now built dark rather than washed over — pulled to
  luminance, cast blue-grey, dropped to ~35% value, sunk into the stone at 94%
  scale, with a dead-eye glyph above them.
- Modal titles enlarged from 30px to `clamp(38px, 4.2vw, 54px)`.

### Engine notes (not shown in game)
- Music loudness spread measured and corrected from **7.54x** loudest/quietest
  down to **1.20x**; BPM spread from **1.93x** (58–112) to **1.26x** (76–96).
  Tuned against a measurement harness (`musiclevel.js`) that sums scheduled
  acoustic energy per second per track, not by ear.
- Per-track trim (`mix`) rides the crossfade gain node rather than every voice.
- Tempo multiplier ramps at 0.006/tick inside the scheduler, clamped to
  1.0–1.35 so a bug cannot run the dirge away. Covered by `tempotest.js`.
- New regression tests: `tempotest.js`, `logtest.js` (the latter asserts
  `VERSION.id` matches the top entry of this file, so they cannot drift).

---

## the_bone_sieve_v1.0.0_beta.2 — "THE SIEVE OPENS" · 2026-07-27

*First public beta.*

### Added
- The Ossuary now marks every burning conduit on the stone with a coloured ring
  and stamps its blood price in front of it — gold for Kind, cyan for Run,
  violet for Parity.
- Bones that earn nothing are drawn cold, sunk and greyed, with a dead-eye mark
  above them.
- Special dice announce themselves: Mirror shows the value it has become, and
  every exotic bone flashes a sigil when its power fires.
- Trials every fifth descent, each with a Boon for breaking it and a permanent
  Decree past the tenth.
- The Altar holds five relics. Binding a sixth means banishing one.
- Seven movements of dirge, a settings Veil with a full mixer, and a changelog.

### Changed
- Chalk lines now carry their multiplier at both ends of the board, burn wider
  as they deepen, and can never be bought for nothing.
- The dirge quickens during a Trial and on your final cast.
- Ritual titles are cut in Hellbone.

### Fixed
- The Warden counted a whole board as one conduit when a Mirror die was in play.
- The top corner of the sieve was clipped on large displays.
- Sound effects were silent after the mixer rebuild.

### Engine notes (not shown in game)
- Fog rebuilt from per-pixel noise (28.7 ms/frame) to baked sprites (0.001
  ms/frame). Board tiles, vignette, embers and die gradients are all cached.
- `backdrop-filter` removed from always-visible HUD; it was forcing a
  full-screen blur every frame.
- Detail setting (High/Medium/Low) replaces the old auto-stepping tier system.
- Music level-matched from a 7.54x loudest/quietest spread down to 1.20x, and
  tempo spread narrowed from 1.93x to 1.26x.
