# Design Decisions

A running log of deliberate, non-obvious decisions for Maths Stars. Each entry records
the decision, the reasoning, and the consequences — so future changes don't quietly
undo something that was chosen on purpose.

---

## 1. Two-layer storage: localStorage base + optional Firebase overlay

**Date:** 2026-06-14

**Decision.** localStorage is the always-on base layer. Firebase Firestore is an
optional overlay, activated only when a valid config is present in `ms_fbconfig`.
Writes go to local first, then also to cloud (write-through). Reads prefer cloud and
fall back to local on any error.

**Why.** The app must work instantly by double-clicking a single `index.html` with no
setup, while also supporting cross-device sync (laptop / iPhone / iPad) for those who
want it. Making cloud optional and local always-present means the app never breaks when
offline or unconfigured, and cloud failures degrade gracefully to local data.

**Consequences.** Local and cloud can diverge (sessions practised before connecting, or
while offline, are never back-filled to cloud). Accepted for a low-stakes family app.

---

## 2. Storage schema versioning: local re-stamps, cloud normalizes on read

**Date:** 2026-06-14

**Decision.** A `SCHEMA_VERSION` constant gates two migration paths:
- **`STORE_MIGRATIONS`** run once per device on boot (`runLocalMigrations()`) and
  physically rewrite localStorage keys/records to the current shape.
- **`RECORD_MIGRATIONS`** run in memory on *every* read via `normalizeRecord()`, for
  both local and cloud data. Cloud documents are **never** mass-rewritten.

Every record carries a `schemaVersion` field. All loads funnel through
`normalizeRecord()` so the rest of the app only ever sees current-shape objects.

**Why.** This is a static HTML file with no deploy gate — different devices may be
running different *cached* versions of `index.html` against the **same shared** Firestore
database. If a device on new code mass-migrated cloud documents into a new shape, a
device still running old cached code could fail to read them. Normalizing cloud data only
in memory means newer code can read older docs and vice versa; nobody corrupts the shared
store. Local data is private to one device's code version, so re-stamping it is safe.

**Consequences.** Cloud documents physically remain at whatever version they were written
at; correctness depends on every read passing through `normalizeRecord()`. **Do not**
"simplify" by skipping normalization on reads, or by adding a cloud mass-migration step —
either reintroduces the cross-version corruption risk. Prefer additive/defensive record
changes; reserve breaking changes for genuine need and handle them via lazy read-time
normalization.

If cloud-side version visibility is ever needed, add an informational `_meta/schema`
document — it must not become a correctness dependency.

---

## 3. Family grouping: families contain players

**Date:** 2026-06-14

**Decision.** Two levels of identity: a **family** (a household) contains **players**.
First-run flow is family name → player name → play. Implementation:
- New `ms_family` localStorage key; every record carries a `family` field.
- Local sessions are keyed `ms_sessions_<enc(family)>|<enc(player)>` (URL-encoded
  parts, `|` delimiter). The delimiter also distinguishes new keys from legacy
  pre-family keys (`ms_sessions_<player>`).
- `getSessions()` returns the whole **family's** records (cloud: `where('family','==')`;
  local: enumerate keys under the family prefix). Callers filter by player where they
  want one person's view (e.g. Home's per-level "best" is the current player; History
  shows the whole family with an optional player filter).
- Schema bumped to **v3**; record migration defaults missing `family` to `'default'`.
- `adoptLegacyData()` folds a device's pre-family `ms_sessions_<player>` keys into the
  chosen family namespace the first time a family is named.

**Why.** The brief wants several family members to practise and see each other's scores.
Grouping by family (rather than only by player) is what makes the shared-history view and
the cloud query work, while still keeping each person's scores attributable.

**Consequences.** Cloud query now filters by `family`, so any pre-existing cloud records
written before this change (which lack a `family` field) won't appear under a named
family — Firestore can't match a missing field. Acceptable as there's little/no
production cloud data yet; if needed, a one-time cloud back-fill can stamp `family` on old
docs. Changing a device's family switches household context: the new family starts with an
empty local history (the old family's local keys remain but are no longer surfaced).

---

## 4. Split JS into ES modules + add unit tests

**Date:** 2026-06-14

**Decision.** Move from a single inline `<script>` to ES modules: `src/app.js` (the
side-effecty UI/storage/Firebase shell) imports pure logic from `src/logic/`
(`questions.js`, `schema.js`, `storage-keys.js`, `stats.js`). `index.html` loads it with
`<script type="module" src="src/app.js">`. Added `tests/` with Node's built-in test runner
(`node --test`, no dependencies) covering the at-risk pure logic: question-generation
invariants (subtraction never negative, division always whole, operand bounds), schema
migration/normalization, the family/player key scheme, and stats. **Still no build step**
— modules load natively.

**Why.** The file was growing and the riskiest code (math rules, schema migrations, key
encoding) had no protection. Splitting the pure logic out makes it unit-testable without a
DOM, so future changes are guarded. Kept to native modules + `node:test` to avoid adding a
bundler or test framework to what is a simple app.

**Consequences.** ES modules don't load over `file://`, so **double-clicking `index.html`
no longer works** — local dev needs a static server (`npm run serve`). Production is
unaffected: GitHub Pages serves over HTTPS with correct MIME types, where native modules
work without a build. Tests require Node (dev-only; not a runtime dependency). Storage
helpers that touch `localStorage` (`runLocalMigrations`, `adoptLegacyData`) stayed in
`app.js` and are not yet unit-tested — covered indirectly by a browser smoke test for now.

---

## 5. Star rewards are derived-and-stored, not a mutable balance

**Date:** 2026-06-14

**Decision.** Each session earns stars (base scaled by length + bonuses for accuracy,
speed-vs-PB, new PB, first try, difficulty, and daily-streak ongoing/milestone). Stars are
computed **when the session finishes**, using the player's prior history, and the breakdown
is **stored on the session record** (`stars: { base, accuracy, speed, pb, firstTry,
difficulty, streak, milestone, total }`). A player's total is the **sum of `stars.total`**
across their sessions. Logic lives in pure `src/logic/rewards.js` (`STAR_CONFIG` holds all
tunable numbers); it's heavily unit-tested. Schema bumped to **v4**: `normalizeRecord`
backfills a *context-free* estimate (base + accuracy + difficulty only) for legacy/old-client
records that lack `stars`. The night sky on Home shows the running total + streak + next
collectible tier.

**Why.** Deriving-and-storing avoids a separate mutable "stars balance" that would need its
own sync and could diverge between local and cloud (the exact problem the storage model was
designed to avoid). Summing per-record stars is recomputable, attributable, and tamper-
resistant, and it lets the results screen show a stable, explainable breakdown. Storing the
breakdown (rather than recomputing on read) is necessary because streak/PB bonuses depend on
cross-session context that single-record `normalizeRecord` can't see. Calibrated so a good
no-streak 10q session ≈ 5 stars; rewards are self-referential (own PB/streak/sky) to stay
age-fair across siblings — no family leaderboard.

**Consequences.** Legacy sessions get base/accuracy/difficulty stars only — no retroactive
streak/PB (those need an ordered replay we deliberately skip). Changing `STAR_CONFIG`
re-prices **future** sessions only; already-stored stars don't change unless re-computed.
Stars are computed at finish using a fresh `getSessions()` read (falls back to local), so a
slow cloud read briefly delays the results screen — acceptable for one read.
