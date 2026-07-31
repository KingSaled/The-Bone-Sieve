# THE BONE SIEVE — Meta-Progression Design (draft v1)

Paper design only. Nothing here has touched the code. Goal: give players a
reason to return between runs without disturbing the single-run balance
you've already tuned through beta.

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

### Trials & Decrees (15 + 5)
**Recommend leaving these ungated for now.** They're already gated *in-run*
by level (`min:5/10/15`), which does real balance work (harsher trials
only show up once a run has proven itself). Meta-gating them too adds a
second axis of complexity for not much payoff. Revisit later if you want a
"Trial Fragments" unlock track as a phase-2 feature.

---

## 3. Small Permanent Power (the "light touch" tier)

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

---

## 4. The Hub Screen

New menu screen, reachable from the main menu (you already have
`openMenu()` / `menuScreen()` — this slots in as another screen, not a
new subsystem). Name: **"The Archive."** (Not "The Reliquary" — that name is
already taken by the tier-3 relic granting +2 altar slots, and two different
things under one name would be unreadable in the Grimoire and the Ossuary.)

Two tabs:
1. **Unlocks** — grid of locked/unlocked dice and relics, grouped by tier,
   each showing its existing tooltip/description plus a Marrow cost and a
   lock icon if unaffordable/not-yet-unlocked. Clicking an affordable
   locked item spends Marrow and unlocks it permanently.
2. **Rites** *(permanent power)* — the short list from §3, same
   buy-once-with-Marrow pattern.

**Display rule, confirmed:** every Marrow-gated item in the Unlocks tab
shows fully — name, icon, description, price — same as if already owned,
just dimmed/locked. It's meant to read as a shopping list. The exception
is story-gated items (see §12): those render as `???` — no name, no
description, no price, just a locked silhouette — until their narrative
flag fires, at which point they flip to a normal unlocked entry with no
purchase step involved. A locked Marrow item and a locked story item
should look visibly different in the grid so a player never mistakes one
for something they could save up for.

A small header shows current Marrow total and maybe lifetime stats (total
runs, deepest descent, best single offering) — you already track
`S.stats` per-run, so lifetime aggregation is a light addition.

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

---

## 6. Pacing Target

Rough goal, tune once you have real playtest data: **a new player should
unlock their first few dice/relics within their first 2–3 runs** (fast
early hook), and **fully unlock everything over roughly 15–25 runs** of
mixed success. That's a guess based on typical roguelite unlock curves
(Hades/Slay the Spire/Balatro all sit in a similar range) — your actual
number depends on how much Marrow a "bad" run vs. a "good" run yields, so
this needs real numbers once implemented.

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

---

## 8. What This Deliberately Does NOT Change

- In-run shard economy, shop pricing, conduit scoring, trial/decree logic
  — all untouched.
- Nothing about a *specific* run's difficulty changes based on meta state,
  other than the small opt-in Rites in §3.
- No new content is created — this is purely a gate + reward layer over
  what already exists.

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
