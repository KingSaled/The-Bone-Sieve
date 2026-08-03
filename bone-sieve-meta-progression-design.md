# THE BONE SIEVE — Meta-Progression Design (v2, updated mid-build)

Original paper design below, preserved as written except where noted.
**Everything in a `> UPDATE:` blockquote reflects a decision made or a
change actually implemented during the build** — treat those as
overriding the paragraph they follow. This doc is now a living record of
build status, not just the original pitch.

Current branch: `meta-progression`. Nothing here has touched `main`.

---

## 1. Core Principle

**Two currencies, two purposes, never mixed:**

| Currency | Scope | Spent on |
|---|---|---|
| **Soul Shards** *(exists today)* | Single run, resets every run | In-run shop: dice, chalk, relics |
| **Marrow** *(new)* | Persists forever, meta-save | Hub: unlocking content into the pool, small permanent upgrades |

Marrow is earned **at the end of every run, identically** (see §5 — the
game has no separate "win" state) and spent
**between runs** in a new hub screen. It never appears mid-run, so the
in-run economy you've tuned stays untouched.

*(Working name "Marrow" — fits the bone/blood aesthetic and won't be
confused with "shards." Open to other names — Ash, Reliquary Points, etc.)*

> UPDATE: Marrow is live. Implemented as `Meta`, a persistent store
> mirroring the same load/save pattern already used for view prefs,
> persisted to `localStorage['boneSieveMeta']`. Marrow is awarded in
> `gameOver()` using the finalized §5 formula, and shown as a payout
> band on the death screen with its components broken out (depth/blood/
> offering/PB bonus) — see §5 update.

**Two unlock trigger types, not one.** Everything above describes the
default path (Marrow-purchase). A second, separate path exists for
narrative content — see §12 for the full spec. In short: some Archive
entries are never purchasable at all. They sit in the grid as `???` until
a story-completion flag flips them, at which point they unlock for free.
This matters for the Archive UI (§4) and the save shape (§7), both
updated below.

---

## 2. What Gets Gated

You have 11 dice and 34 relics already built and balanced. Rather than
building new content, meta-progression's first job is **controlling when
the player meets each piece of content you already have.**

> UPDATE: the actual relic count is **37**, not 34 (§9's own breakdown of
> 7+17+9+4 always summed to 37 — this headline number was just stale).
> Doesn't affect anything already built since starters are derived by
> tier, not counted by hand, but §10 pricing should work from 37.

> UPDATE: chalks are also gated now, which this section originally didn't
> call for. See the new §2b below — this was a build-time addition after
> a real balance problem surfaced in playtesting, not part of the
> original plan.

### Dice (11 total)
- **Always unlocked:** `bone` (already the sole starting die — no change).
- **Locked at game start, unlocked via Marrow:**
  - Tier 1 unlocks (cheap, early): `runt`, `rotting`
  - Tier 2 unlocks (mid): `twin`, `hex`, `ivory`, `thorn`, `gilded`
  - Tier 3 unlocks (later): `obsidian`, `mirror`
  - Tier 4 unlock (capstone): `crimson`

A locked die simply isn't in `DIE_WARES`'s active pool, so it can't appear
in the shop or as a boon reward until unlocked. No gameplay code changes —
just a filter on pool-building.

> UPDATE: implemented exactly as described. `freshState()` snapshots a
> run's shop pool from the ledger's unlock lists once at run start (not a
> live per-draw filter) — so a mid-run unlock never reaches the run
> already in progress, only the next one. Confirmed the boon table draws
> from nothing but itself (`BOONS`, all stat modifiers) — the original
> "can't appear in the shop or as a boon reward" phrasing above was
> already stale by the time this was built; boons never granted dice or
> relics directly, so there was nothing to gate there.

### Relics (34 total)
Same idea, but relics are the deeper long-tail, so I'd stagger them harder
than dice:
- **Start with a curated subset unlocked** (proposal: 8–10 tier-1/tier-2
  relics that represent each major strategy — a multiplier relic, a shard
  relic, a conduit-type relic, a cluster relic — so early runs still feel
  like the current beta build, just with a shop pool that's a bit smaller
  and less overwhelming for new players).
- **Everything else unlocks progressively**, tier 1 → 4, cheapest first.
- Tier 4 ("legendary/cursed") relics like `ouro` (Ouroboros) or `crownt`
  (Crown of Teeth) become explicit **long-term goals** — "beat 10 runs to
  afford this."

> UPDATE: went with exactly the 7 named tier-1 relics from §9, not 8–10 —
> see §9 update for why the count landed there. Derived by filtering
> `tier === 1`, so it won't drift if the relic table grows later.

### 2b. Chalks — added mid-build, not in the original plan

> UPDATE: playtesting after the Archive first shipped found a fresh save
> — bone die + 7 starter relics only, everything else correctly locked —
> could still push to descent 20+, because chalks were still fully
> available and unbounded chalk-stacking (specifically repeated use of
> the line-deepening chalk) was strong enough on its own to trivialize
> the gate. The gating system was correctly withholding relic power but
> leaving an ungated escape valve standing.
>
> Fix, now live: all chalks (row, column, cross, deepen) are gated into
> the Archive exactly like dice and relics, as a third grid group. The
> line-deepening chalk (`Deepen the Sigil`) was additionally moved from
> tier 2 to **tier 4** — it's the one ware in the game with no real power
> ceiling (repeatable multiplier-on-a-multiplier against the same line),
> so tier 2 pricing and tier 2 availability were both wrong for what it
> actually does. Tier 4 means it's also now gated behind lifetime descent
> 25, same as top-tier relics — see §9 update.
>
> Side effect confirmed by data: this also fixed the underlying
> `tierWeight()` distortion for fresh saves specifically, since chalks
> were absorbing all the tier-2/3 shop weight that had nowhere else to
> go in a thin, all-tier-1 pool. A fresh save's shop is now flat at ~13%
> bone die / 87% relic across all depths, versus 23%→66% chalk share
> before the fix. **The same distortion for partially-unlocked saves is
> still open** — flagged as a follow-up, not solved by this fix, since a
> player who's behind on tier-2/3 relics relative to their depth will
> still see some version of this.
>
> One knock-on caught during the fix: a `deepchalk`-related boon existed
> that would have been a guaranteed-dead pick on any fresh save (boons are
> a forced one-of-three at a Trial, not declinable, so a dead card there
> silently costs a third of the reward). That boon now only appears when
> a line can actually exist that descent — one already scrawled, a chalk
> ware still purchasable, or a specific relic that draws a free line every
> level. Confirmed separately: `Corpse Lamp` (a relic that boosts chalk
> multiplier) has the same "could be dead weight" shape but was left
> alone, since it's a purchase made with full visible information, not a
> forced pick.

### Trials & Decrees (15 + 5)
**Recommend leaving these ungated for now.** They're already gated *in-run*
by level (`min:5/10/15`), which does real balance work (harsher trials
only show up once a run has proven itself). Meta-gating them too adds a
second axis of complexity for not much payoff. Revisit later if you want a
"Trial Fragments" unlock track as a phase-2 feature.

> UPDATE: unchanged, as planned. No build work has touched this.

---

## 3. Small Permanent Power (the "light touch" tier) — RESTRUCTURED

Kept deliberately minor — these should feel like quality-of-life, not
power creep that trivializes your tuned difficulty curve. Each is a
one-time Marrow purchase, capped (no infinite stacking):

- **+1 starting die** in the pool at run start (bone die) — one purchase only
- **+1 starting reroll** on level 1 only — one purchase only
- **Cheaper first shop reroll** (small shard discount, run 1 shop only)
- **+3 starting soul shards**
- Possibly, much later: **+1 altar slot**, gated expensive, since `shrine`
  relic already grants +2 — don't want to undercut that relic's value.

Rule of thumb: none of these should let a player skip a system (e.g.
never "start with a relic already equipped" — that undermines the
shop-choice loop that's core to the run).

> UPDATE — this section is being rebuilt before implementation, not built
> as originally written. Review of the starting numbers (12 dice, 5 relic
> slots, 2 rerolls) made clear that even one extra die or reroll is a
> meaningful power shift, not the "light touch" this section assumed —
> going from 2 rerolls to 3 is a 50% increase in the single most limited
> resource in the shop loop. "One-time purchase" undersold what these
> actually do.
>
> Finalized structure, about to be built as **Phase 4**:
> - Each of the four upgrades becomes a **tiered ladder**, bought as a
>   strict progression (no skipping levels even with enough Marrow),
>   price escalating per level.
> - **Extra starting die** and **extra starting reroll**: capped at **3
>   levels** each. These directly affect run power and compound with
>   everything else a player unlocks, so they're capped tight.
> - **Cheaper reroll cost** and **extra starting shards**: capped at **5
>   levels** each. These are economy smoothing, not power, so they can go
>   deeper as a long-term Marrow sink without the same risk — this also
>   keeps the game's endless-mode design from handicapping a player who's
>   unlocked everything and is pushing for max depth.
> - The **last two levels of every ladder** are additionally gated behind
>   lifetime descent 15 and 25 (same thresholds as §9's depth-gates), so a
>   player can't dump all their early Marrow into maxing these out before
>   engaging with the rest of the Archive.
> - Each level stacks additively with the levels below it (reroll level 2
>   = +2 total, not +2 instead of +1).
>
> The "+1 altar slot" idea and its shrine-relic conflict were not
> revisited — still an open idea, not scheduled.
>
> BUILT (Phase 4). All four ladders are live, with the caps, the strict
> progression and the 15/25 gates on the last two rungs exactly as
> specified above. What was decided during the build:
>
> - **They are called THE OATHS in the UI**, not the Rites. In this
>   game's own voice a *rite* is a run — the title screen says BEGIN THE
>   RITE, the Archive's ledger counts RITES to mean runs performed, and a
>   *descent* is a level within one. A tab called THE RITES beside a stat
>   called RITES was two meanings of one word an arm's length apart. The
>   save field, every identifier and this document still say `rites`;
>   only the player-facing strings changed. `ARC_OATH_LABEL` and the four
>   `name` fields are the only strings to move if this reads wrong.
> - **Effects, per level, stacking additively:** +1 bone in the opening
>   cup (clamped to the pool cap); +1 re-roll on every cast; −1 shard on
>   the Ossuary's re-roll cost, floored at 2; +3 opening soul shards.
> - **The re-roll floor of 2 is deliberate.** `Skeleton Key` (tier 2)
>   makes new wares a flat 1 *and* lays out a fifth ware. Letting the
>   ladder reach 1 would have eaten half a relic the player can still be
>   charged shards for — the same care §3 asked for around `shrine` and
>   the altar slot. The relic stays strictly better.
> - **Prices (placeholder, same caveat as §10):** power ladders
>   60/160/340, economy ladders 40/90/160/250/360. All four ladders
>   together are 2,920 Marrow — more than the whole 2,535 content roster,
>   which is intended: content is revealed once, an Oath is collected on
>   for the rest of a career. Everything in the Archive is then ~5,455
>   Marrow, or 55–68 runs. That is a long tail *by design* (§3 wanted a
>   sink for a player who has bought the roster out), but it is the
>   number to check first if the endless game feels like a grind.
> - **The run snapshots its Oaths at birth**, in `freshState()`, the same
>   way `S.wares` snapshots the unlock pool and for the same reason: a
>   ladder bought between runs is the player's to buy, but a descent
>   already in progress must not have its own rules move under it.
>
> SCHEMA LANDED AHEAD OF THE BUILD: the save side of this restructure is
> now live, separately from Phase 4 itself. `rites` was four booleans; it
> is now four integer ladder levels plus `extraAltar`, which stays a
> reserved boolean since this section never revisited it. Caps live in a
> new `RITE_MAX` table (3 / 3 / 5 / 5, per the four bullets above) and are
> applied on load, so a hand-edited save cannot claim level 99. `save`
> version bumped to 2 with a real `migrateMeta()` step: a v1 ledger's
> `true` becomes level 1 and `false` becomes level 0, so a career that
> already bought a Rite keeps it. What a level *costs* and what it *does*
> are still Phase 4 — nothing sells a level and nothing reads one yet.

---

## 4. The Hub Screen

New menu screen, reachable from the main menu (you already have
`openMenu()` / `menuScreen()` — this slots in as another screen, not a
new subsystem). Working name: ~~"The Archive."~~

> UPDATE: name locked in during build, not just a working name anymore.
> **The Archive** is final — the original doc actually proposed "The
> Reliquary" here before this section was revised; that name collided
> with the existing tier-3 shrine relic and was changed early, before any
> code referenced it. No further renaming is planned.

Two tabs:
1. **Unlocks** — grid of locked/unlocked dice and relics, grouped by tier,
   each showing its existing tooltip/description plus a Marrow cost and a
   lock icon if unaffordable/not-yet-unlocked. Clicking an affordable
   locked item spends Marrow and unlocks it permanently.
2. **Rites** *(permanent power)* — the short list from §3, same
   buy-once-with-Marrow pattern.

> UPDATE: Unlocks tab is live — 52 entries (11 dice + 4 chalks + 37 relics, after
> the §2b addition), grouped by tier, each showing icon/name/description
> and one of four states: owned, a Marrow price, unaffordable, or
> depth-gated with the requirement shown instead of a price. Purchases
> require a confirm step (hold / cost / what's left) before spending —
> added deliberately, since this is permanent spend, not a run-scoped
> shop pick. A ledger bar shows current Marrow plus lifetime stats
> (rites run, deepest descent, best offering, trials cleared), and each
> half of the roster shows an owned count.
>
> Current layout is intentionally plain — flat plaques, not the shop's
> 3D-tilting/compositor-layered ware cards — because the shop's treatment
> assumes only 4–5 cards on screen at once and the Archive shows up to 52.
> **A full visual redesign is planned but deliberately deferred** until
> Rites, loadout toggles, and the story `???` scaffold are all functionally
> in place — redesigning now would mean redesigning twice, once for the
> current content and again once three more content types land on the
> same screen.
>
> The Rites tab is now live (Phase 4), shipped as **THE OATHS** — see the
> §3 update for why the label differs from the code. The screen is now
> genuinely two tabs (THE ROSTER / THE OATHS) sharing one ledger bar,
> since both halves spend one purse. Each Oath renders as a single wide
> plaque rather than a grid cell: a ladder has to answer three questions
> at once (how far up, what the next rung costs, what it does), which
> reads better stacked. Rungs are shown as pips in three states — paid
> for, reachable, still behind a descent key — so the two locked reasons
> never look alike. Purchases reuse the same confirm dialog as the
> roster; an Oath is permanent spend exactly as an unlock is, and a
> player should not have to learn a second way to buy on one screen.
>
> The deferred visual redesign noted above still stands, and now has one
> more content type on the screen to redesign around.
>
> A related feature landed alongside this, not originally scoped in this
> doc: a **save-wipe option** ("Scour the Archive") in the settings menu,
> for clean repeat playtesting. Confirm-gated (not the same arm-then-
> confirm pattern as abandoning a run, since a double-click could
> satisfy that by accident for something this permanent), shows exactly
> what's at stake before wiping, explicitly states it cannot be undone.

**Display rule, confirmed:** every Marrow-gated item in the Unlocks tab
shows fully — name, icon, description, price — same as if already owned,
just dimmed/locked. It's meant to read as a shopping list. The exception
is story-gated items (see §12): those render as `???` — no name, no
description, no price, just a locked silhouette — until their narrative
flag fires, at which point they flip to a normal unlocked entry with no
purchase step involved. A locked Marrow item and a locked story item
should look visibly different in the grid so a player never mistakes one
for something they could save up for.

> UPDATE: the Marrow-gated display rule is implemented as described. The
> story-gated `???` rendering path does not exist yet — reserved for
> whenever the story scaffold phase happens (see §12).

A small header shows current Marrow total and maybe lifetime stats (total
runs, deepest descent, best single offering) — you already track
`S.stats` per-run, so lifetime aggregation is a light addition.

> UPDATE: implemented as the ledger bar described above.

---

## 5. Earning Marrow — FINALIZED FORMULA

Award **on every run end** (`gameOver()`). **Confirmed: there is no
separate "win" state and no separate win-bonus.** The game stays endless
by design even after the full narrative is discovered (see story bible
§2, "Delivery & Pacing" — post-twist is a soft acknowledgment layer, not
a different game mode). Every run end, regardless of how far the
narrative has progressed, uses the exact formula below — no branch, no
special case. The only reward tied to narrative completion is the
one-time special die and relic (§12); it is not, and should not become,
a Marrow multiplier or bonus of any kind.

The three inputs you want factored in (descent level, total blood, best
single roll) live on wildly different scales — depth is a small integer,
blood and best-roll can span from low thousands to 300K+ on a fully
unlocked, high-multiplier build. Adding them raw would let blood/roll
completely swamp depth, which is backwards: depth is the thing this
system is supposed to reward. So blood and best-roll are compressed
(square root) and soft-capped per run; depth stays linear and effectively
uncapped, since the exponential quota curve is already the real limiter
on how deep anyone gets.

```
depthComponent   = level × 3                                    // uncapped
bloodComponent   = min(60, floor(sqrt(totalBlood) / 10))         // capped
rollComponent    = min(20, floor(bestSingleOffering / 1000))     // capped
pbBonus          = 50   // ONE-TIME, only the run a player exceeds
                         // their prior lifetime-deepest level

Marrow = depthComponent + bloodComponent + rollComponent + (pbBonus if applicable)
```

**Why this is the anti-snowball mechanism, not a bolt-on rule:** the
single biggest Marrow payday in the game is the PB bonus — going one
level deeper than you ever have. A player who grinds a broken high-shard
build at a shallow, safe depth over and over caps out fast on the blood
and roll components and never sees the PB bonus at all. A player pushing
their actual depth record earns steadily *and* periodically spikes. That
directly rewards the behavior you said you want ("really work toward
getting higher levels of descent") instead of rewarding whichever build
maximizes shard totals.

**Calibrated against your real playtest numbers:**

| Run | Level | Total blood | Best roll | Marrow |
|---|---|---|---|---|
| Your best runs | 25 (not yet beaten) | ~300,000 | ~26,000 | 75 + 55 + 20 = **150** (+50 if new PB) |
| A modest early run | 10 | ~20,000 | ~5,000 | 30 + 14 + 5 = **49** |
| A rough early run | 4 | ~4,000 | ~1,200 | 12 + 6 + 1 = **19** |

That's a healthy spread: your best runs earn roughly 3x a modest run, not
15–20x — which is what keeps per-run Marrow in double/triple digits on
purpose. That in turn is what solves the "50K Marrow vs 25K prices"
concern directly: if strong runs net ~150 and a lifetime total after
20–30 runs sits in the low thousands, Archive prices built as small
multiples of a *single run's* output (tens to a few hundred per item)
stay in the same order of magnitude as what a player is actually holding
— no six-digit numbers required anywhere in the meta-economy.

**Sequencing, confirmed:** this formula's shape is locked. Archive
pricing (§10) is tuned *against* it next — e.g. "a tier-2 relic should
cost roughly 3–4 solid runs' worth of Marrow" becomes a price derived
from this table, not a second independent guess.

**Resolved:** no shard→Marrow conversion (per your concern about 500+
shard runs snowballing the meta-economy) — total blood already factors
in above, compressed and capped, which captures "did the player have a
strong economy" without letting an outlier run dominate.

> UPDATE: implemented exactly as specified, and it reproduces the
> calibration table above almost exactly in practice (a real 300K-blood,
> level-25-ish run returned 149 rather than 150 — the doc's "150" rounds
> 54.77 up, the actual floor() gives 54; everything else matches).
> Awarded in `gameOver()`, with the breakdown (depth/blood/offering/PB)
> shown on the death screen as its own payout band rather than folded
> into the existing per-run stat grid — the existing stats are a record
> of what the run lost, Marrow earned is the one forward-looking number
> on that screen, so it's visually separated.

---

## 6. Pacing Target

Rough goal, tune once you have real playtest data: **a new player should
unlock their first few dice/relics within their first 2–3 runs** (fast
early hook), and **fully unlock everything over roughly 15–25 runs** of
mixed success. That's a guess based on typical roguelite unlock curves
(Hades/Slay the Spire/Balatro all sit in a similar range) — your actual
number depends on how much Marrow a "bad" run vs. a "good" run yields, so
this needs real numbers once implemented.

> UPDATE: current placeholder pricing (shard price × 3, including the
> newly-gated chalks) puts the full **52-item** roster — 11 dice, 4 chalks,
> 37 relics, of which 44 are locked on a fresh save — at **2,535** total
> Marrow (845 shards: 144 dice, 76 chalks, 625 relics).
>
> Against §5's real numbers, that's roughly **25–32 runs** at a realistic
> 80–100 Marrow/run average, versus the 15–25 target. Still a tuning pass
> rather than a structural problem, but a slightly wider gap than first
> recorded here: this block originally read "48-item" and "23–29 runs",
> both of which were computed before §2b gated the chalks and neither of
> which was recomputed when it did. 48 was dice + relics only, and the
> 23–29 figure came from the pre-chalk total of 769 shards / 2,307 Marrow.
> Corrected in the doc and in the code comment at `MARROW_PRICE_MULT`.
> Flagged, not yet acted on.

---

## 7. Save Data Shape (conceptual, not code)

A `metaState` object, separate from your existing run `S`, persisted to
`localStorage` under its own key (e.g. `boneSieveMeta`) so it never
collides with your existing `boneSieveAudio` / `boneSieveDetail` /
`boneSieveView` prefs:

```
metaState = {
  marrow: 0,
  unlockedDice:   [ 'bone', ... ],   // grows over time — Marrow-gated AND
                                      // story-gated dice both land here
                                      // once unlocked; one array, two ways in
  unlockedRelics: [ ...tier1 starters... ],   // same dual-source pattern
  rites: { extraDie:false, extraReroll:false, cheapReroll:false, extraShards:false },
  lifetime: { runs:0, deepestLevel:0, bestOffering:0, trialsCleared:0 },

  // --- reserved now, populated later ---
  // Narrative beats (see story bible §3/§12) each fire once and are
  // recorded here so the milestone dispatcher never re-fires one and
  // so the Archive knows which story-gated entries have unlocked.
  storyBeatsFired: [],          // ordered beat-table keys, in fire order
  storyComplete: false,          // flips true once the ledger beat fires
                                  // and the final die/relic unlock

  // Tutorial state — schema reserved during THIS build even though the
  // tutorial ships later, so there's no save migration needed for it.
  // See tutorial design doc §(save state) for how these get used.
  tutorial: { seen:false, skipped:false },
}
```

**Steam flag:** `localStorage` is fine for now (web build, playtesting).
Once you package with Electron/Tauri for Steam, this needs to move to an
actual save file on disk (and eventually Steam Cloud) — worth keeping in
mind so the save shape stays simple/serializable, but not something to
solve today.

> UPDATE: implemented as `Meta.data`, matching this shape closely with
> two additions beyond what this doc specified:
> - `version` + a `migrateMeta()` pass-through stub. The reasoning: the
>   point of nailing the shape down up front was to make migration
>   *unlikely*, not to make it *impossible to recover from* — cheap
>   insurance against having to discard a returning player's save months
>   from now if the shape does need to change.
> - `disabledDice` / `disabledRelics` — needed for §11's loadout toggles,
>   which are persistent player choices but were missing from this
>   doc's save shape entirely. Stored as an off-list (exceptions) rather
>   than a flag per item, since "on" is the common state and a sparse
>   exceptions list can't drift out of sync with the content tables as
>   new content is added.
> - `unlockedChalks` / `disabledChalks` were added alongside the §2b
>   chalk-gating work, following the same pattern as dice/relics.
>
> `migrateMeta()` is no longer a stub — see §3's update. The insurance
> paid for itself on the very first shape change: `rites` went from
> booleans to ladder levels, which is a change of *type* on a field a
> player may already have spent Marrow on, and is exactly the case the
> version field was reserved for. Save version is now 2.
>
> Unlock ids are validated for shape on load, deliberately **not**
> validated against the live `DIE_TYPES`/`RELICS` tables — §12A's
> death-generated dice mean a legitimate unlocked id may reference
> something no static table in the file has heard of yet. Strict
> validation would silently delete content a player actually earned.

---

## 8. What This Deliberately Does NOT Change

- In-run shard economy, shop pricing, conduit scoring, trial/decree logic
  — all untouched.
- Nothing about a *specific* run's difficulty changes based on meta state,
  other than the small opt-in Rites in §3.
- No new content is created — this is purely a gate + reward layer over
  what already exists.

> UPDATE: still true. The §2b chalk-gating fix and the §3 Rites
> restructure both changed *how permanent power is gated/priced*, not
> the underlying run mechanics themselves — no in-run system was altered.

---

## Decisions (locked in)

1. **Currency name:** Marrow. **Hub name:** The Archive.
2. **Gating:** delegated to me — see §9/§10 below for the concrete plan.
3. **Pricing:** curve-based, reusing the game's existing tier/price data
   rather than inventing a second balance pass — see §10.
4. **Shard→Marrow conversion:** **no.** Confirmed risk: your own playtests
   have hit 500+ shard runs, so tying Marrow to shard totals would let a
   single lucky/broken economy run blow through months of intended unlock
   pacing. Marrow stays tied to **depth and milestones only**, never to
   in-run shard totals. This also keeps the two currencies conceptually
   clean — shards measure a run, Marrow measures a career.
5. **Trials/decrees:** confirmed ungated, unchanged.
6. **No level cap confirmed** — `quotaFor()` scales forever
   (asymptotic ~28.8% minimum growth/level), decrees cap at 6 total,
   hardest trial tier unlocks at level 15+. The game is already endless by
   design; there's no "level 25 = win." This is good — it means Marrow
   rewards for depth naturally scale into an open-ended long game, and
   there's room to slot in new boons/decrees/trials later without
   restructuring anything.

---

## 9. Gating Plan (my call, as requested)

**Starting content — unlocked from a fresh save, no Marrow needed:**
All 7 tier-1 relics (`dust`, `candle`, `hook`, `nail`, `obol`, `censer`,
`ember`) plus the `bone` die (already the only starting die today). Tier-1
relics are cheap, low-complexity, and represent the basic strategy
archetypes (multiplier, shards, flat blood, conduits) — starting here
keeps a fresh save feeling close to the current beta build rather than
stripped-down.

**Everything else locked at save creation:**
- Dice: `runt`, `rotting` (early unlocks) → `twin`, `hex`, `ivory`,
  `thorn`, `gilded` (mid) → `obsidian`, `mirror` (late) → `crimson`
  (capstone).
- Relics: all 17 tier-2 → all 9 tier-3 → all 4 tier-4
  (`mask`, `crownt`, `moon`, `ouro`).

**Depth-gates, layered on top of Marrow cost** — this is the piece that
directly serves "players should work toward higher descent," not just
grind shallow runs repeatedly for currency:
- Tier-3 relics and `obsidian`/`mirror` dice require having **reached
  level 15 at least once** (lifetime best), *in addition to* affording
  the Marrow cost.
- Tier-4 relics and the `crimson` die require having **reached level 25
  at least once**.
- Marrow itself can still be earned on any run of any depth — the
  depth-gate isn't about currency, it's a one-time "prove you can survive
  this far" key that then stays permanently unlocked. A shallow-run
  grinder can stockpile Marrow but literally cannot spend it on
  top-tier content until they've gone the distance once.

This means the "endless descent" isn't just flavor — reaching level 15
and level 25 become concrete, visible goals with a payoff attached, which
is exactly the hook you described wanting.

> UPDATE: implemented exactly as written, and then reused for two things
> this doc didn't originally cover: `Deepen the Sigil` (§2b) inherited
> the tier-4/descent-25 gate once it moved to tier 4, and the last two
> levels of each Phase 4 Rites ladder (§3 update) use these same 15/25
> thresholds rather than inventing new ones — keeping "prove you can
> survive this far" as one consistent gating language across the whole
> Archive, not a special case per system.
>
> Confirmed via a real playtest that this gate matters: before the §2b
> chalk fix, a fresh save with only starter relics reached descent 20+
> through chalk-stacking alone, which would have let a player buy
> tier-3-gated content (descent 15 met) well before actually earning it
> through relic/die power. The chalk fix addressed the root cause; the
> depth-gate was doing its job correctly the whole time.

---

## 10. Pricing Curve

Reuse the relic/die `price` field that already exists in the code — those
numbers already encode your intended relative power/rarity within a tier
(tier-1: 8–12, tier-2: 13–20, tier-3: 21–28, tier-4: 31–36). Rather than
hand-tuning a second set of costs, Marrow price = that existing shard
price run through a flat conversion multiplier, so relative costs within
and across tiers automatically mirror the balance you've already done.
Exact multiplier needs real Marrow-earn-rate data once built (placeholder
only) — but the *shape* of the curve is already solved by data you have.

> UPDATE: implemented as shard price × 3, marked in code as an explicit
> placeholder pending real data (see §6 update — currently landing just
> outside the pacing target, small tuning pass expected later, not a
> rework). Chalks, once gated in §2b, were folded into this same formula
> rather than getting separate pricing logic.

---

## 11. Loadout Toggles ("keep my build pure")

Once something is unlocked, add a per-item **on/off toggle** in The
Archive (separate from the unlock state — unlocking is permanent,
toggling is a loadout choice made before a run). Toggled-off items are
simply excluded from `SHOP_POOL`/`DIE_WARES` for the next run, same
mechanism as the lock filter. This lets a player who's unlocked
everything still choose to run, say, "no wild dice" or "no shard relics"
for a tighter build focus or a self-imposed challenge — costs nothing to
build since it's the same filter the unlock system already needs.

> UPDATE: not built yet. The save fields (`disabledDice`/`disabledRelics`,
> and `disabledChalks` after §2b) already exist and are honored by the
> run-pool filter — but nothing in the UI writes to them yet. This is
> the next phase after Phase 4 (Rites).

---

## 12. Story-Gated Unlocks (confirmed, cross-referenced with story bible)

A second, parallel unlock path alongside Marrow-purchase. Two categories,
both living in the same Archive grid, both shown as `???` until their
flag fires:

**A. Death-generated dice (story bible — "deaths past depth 15+ feed the
dice pool").** Each qualifying death authors a new die entry with
generated remains-flavor text (see story bible §4 note below — flavor
only, no new mechanical variance; these reuse an existing die type's
stats, just re-skinned). The moment one is generated:
- it appears in the Archive as `???` (its existence is revealed, its
  identity isn't yet — this is the "wait, what is that" hook),
- and it's **automatically added to the player's active pool** — no
  Marrow spend, no manual unlock click. The Archive entry then updates
  to show what it actually is, purely as a record/reference, not a gate
  the player has to clear.

**B. The story-completion die and relic.** Two specific, hand-authored
items (not generated), reserved from the start as the sole reward for
discovering the full narrative (reading the ledger — story bible §2/§3).
These sit in the Archive as `???` from a fresh save, with **no Marrow
price shown at all** (distinct from a normal locked item, which shows its
price). They flip to unlocked — and drop into the player's permanently
available pool — the instant `storyComplete` is set. Never purchasable,
never depth-gated, never appear as a boon or shop offer before that flag.

Both categories share one save field pattern (`unlockedDice` /
`unlockedRelics` gain entries from either source — see §7), so the
gating filter that already needs to exist for Marrow items doesn't need
a second code path to *apply* the unlock, only a second path to *grant*
it.

> UPDATE: not built yet, and deliberately not scheduled until narrative
> content exists — this needs its own content pass (hand-authored
> remains-flavor text pool for §12A, the two actual story items for
> §12B) before there's anything to scaffold against. The save fields
> (`storyBeatsFired`, `storyComplete`) are already reserved per §7. The
> `???` render path in the Archive grid does not exist yet either — planned
> as its own small scaffold-only phase (schema + render path, no content)
> once the functional build (Rites, loadout toggles) is done.

---

## Still Open

- §5's Marrow formula is now finalized in shape *and* constants, calibrated
  against real playtest data — should hold up until it's actually running
  live and can be checked against a broader sample of runs/players.
- §10's Archive pricing is the next thing to nail down, now that it has
  something concrete to be tuned against (see §5's "sequencing, confirmed"
  note) — e.g. deciding how many "solid runs" each tier should cost.
- Whether the level-15 / level-25 depth-gate thresholds are the right
  numbers, or should track your own sense of what's "a genuinely hard
  run" vs. "a good run" from playtesting.
- Exact generation logic for death-flavor dice text (§12A) — a hand-
  authored pool of remains-descriptors to mix and match, most likely;
  needs its own small content pass whenever narrative work starts.

> UPDATE — still open, current state:
> - §10 pricing: landing at ~23–29 runs to fully unlock, vs. the ~15–25
>   target — close, expected to need a small multiplier tune once real
>   Marrow-earn data exists across more players, not before.
> - Depth-gate thresholds (15/25): unchanged, no evidence yet suggesting
>   they're wrong — the chalk-stacking incident actually validated the
>   *mechanism*, the bug was elsewhere (ungated chalks), not the numbers.
> - §12A generation logic: still fully unscheduled, correctly untouched.
> - **New, not in the original open-items list:** `tierWeight()` doesn't
>   normalize against the *live* (partially-unlocked) shop pool, only the
>   absolute tier curve. Fully solved for fresh saves as a side effect of
>   §2b's chalk gate, but will resurface in milder form for any
>   partially-unlocked save whose owned relics skew tier-1-heavy relative
>   to their depth. Needs its own balance pass with real data — flagged,
>   not fixed.
> - **New (Phase 4):** Oath pricing is a placeholder on the same footing
>   as §10's multiplier, and it is the larger of the two open pricing
>   questions now — the four ladders total 2,920 Marrow against the
>   roster's 2,535. Needs the same real-data pass, and should probably be
>   tuned *after* §10, since the roster is the thing §6's pacing target
>   is actually written about.
> - **New (Phase 4):** whether THE OATHS is the right player-facing name
>   for what the code calls rites. Decided during the build to avoid a
>   collision with "rite = one run"; flagged here because it is a naming
>   call the director may want to overrule, and it is four strings.
> - **New:** a UI collision where the tier-3+ rarity rim and the
>   "selected" card outline used the same gold color, found during
>   playtesting and fixed (selection now uses violet) — noted here only
>   because it's the kind of thing worth checking again once the Archive
>   redesign (§4) happens, in case the new visual language reintroduces it.