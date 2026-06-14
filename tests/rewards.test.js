import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSessionStars, contextFreeStars, totalStars, currentStreak,
  difficultyStars, tierFor, nextTier,
} from '../src/logic/rewards.js';

/* Helper: build a session record. */
const rec = (o={}) => ({
  level:1, total:10, correct:9, timeMs:60000, date:'2026-06-10T12:00:00', ...o,
});

/* ---------- calibration: a "good" 10q session ≈ 5 ---------- */
test('good 10q session (90%, not first, not a PB, no streak) earns 5 stars', () => {
  // prior session at this level that is BETTER (no PB), FASTER (no speed),
  // and several days ago (no streak) — isolates the base+accuracy baseline.
  const prior = [ rec({ correct:10, timeMs:30000, date:'2026-06-05T12:00:00' }) ];
  const s = computeSessionStars(rec({ correct:9, timeMs:60000, date:'2026-06-10T12:00:00' }), prior);
  assert.equal(s.base, 2);        // round(10/5)
  assert.equal(s.accuracy, 3);    // >=90%
  assert.equal(s.speed, 0);
  assert.equal(s.pb, 0);
  assert.equal(s.streak, 0);
  assert.equal(s.total, 5);
});

test('that same good session, played on a 2-day streak, earns 6 (streak bonus)', () => {
  // one prior day (yesterday) -> streak length 2, below the first (3-day) milestone
  const prior = [ rec({ correct:10, timeMs:30000, date:'2026-06-09T12:00:00' }) ];
  const s = computeSessionStars(rec({ correct:9, timeMs:60000, date:'2026-06-10T12:00:00' }), prior);
  assert.equal(s.streakLen, 2);
  assert.equal(s.streak, 1);
  assert.equal(s.milestone, 0);
  assert.equal(s.total, 6);  // 5 + ongoing streak bonus
});

test('perfect 10q with a new PB earns more (calibration upper end)', () => {
  const prior = [ rec({ correct:8, timeMs:90000, date:'2026-06-09T12:00:00' }) ];
  const s = computeSessionStars(rec({ correct:10, timeMs:50000 }), prior);
  assert.equal(s.accuracy, 4);    // 100%
  assert.equal(s.pb, 2);          // beat prior best (8 -> 10)
  assert.equal(s.speed, 1);       // 50000/10 within 10% of best 90000/10
  assert.ok(s.total >= 8, `expected >=8, got ${s.total}`);
});

/* ---------- base scales with length (pro-rata-ish) ---------- */
test('base scales with question count', () => {
  const prior = [ rec({ correct:10, timeMs:1000, date:'2026-06-09T12:00:00' }) ];
  assert.equal(computeSessionStars(rec({ total:20, correct:18 }), prior).base, 4);
  assert.equal(computeSessionStars(rec({ total:5,  correct:5  }), prior).base, 1);
});

/* ---------- accuracy bands ---------- */
test('accuracy bands: 100/90/80/70/below', () => {
  const prior = [ rec({ correct:10, timeMs:1000, date:'2026-06-09T12:00:00' }) ];
  const acc = c => computeSessionStars(rec({ correct:c, timeMs:99999 }), prior).accuracy;
  assert.equal(acc(10), 4);
  assert.equal(acc(9), 3);
  assert.equal(acc(8), 2);
  assert.equal(acc(7), 1);
  assert.equal(acc(6), 0);
});

/* ---------- difficulty tiers ---------- */
test('difficulty stars by level tier', () => {
  assert.equal(difficultyStars(1), 0);
  assert.equal(difficultyStars(4), 0);
  assert.equal(difficultyStars(5), 1);
  assert.equal(difficultyStars(6), 1);
  assert.equal(difficultyStars(7), 2);
  assert.equal(difficultyStars(9), 2);
});

/* ---------- first try ---------- */
test('first attempt at a level earns the first-try bonus and no PB/speed', () => {
  const s = computeSessionStars(rec({ correct:10, timeMs:1000 }), []);
  assert.equal(s.firstTry, 1);
  assert.equal(s.pb, 0);
  assert.equal(s.speed, 0);
});

/* ---------- PB detection ---------- */
test('a new PB is awarded; matching-but-not-better is not', () => {
  const prior = [ rec({ correct:7, timeMs:60000, date:'2026-06-09T12:00:00' }) ];
  assert.equal(computeSessionStars(rec({ correct:8, timeMs:99999 }), prior).pb, 2); // more correct
  assert.equal(computeSessionStars(rec({ correct:7, timeMs:60001 }), prior).pb, 0); // same score, slower
  assert.equal(computeSessionStars(rec({ correct:7, timeMs:59999 }), prior).pb, 2); // same score, faster
});

/* ---------- speed window ---------- */
test('speed bonus needs >=90% accuracy and near-best time', () => {
  const prior = [ rec({ correct:10, total:10, timeMs:50000, date:'2026-06-09T12:00:00' }) ]; // best avg 5000/q
  // 90% accuracy, time within 10% (5400/q <= 5500) -> speed
  assert.equal(computeSessionStars(rec({ correct:9, total:10, timeMs:54000 }), prior).speed, 1);
  // too slow
  assert.equal(computeSessionStars(rec({ correct:9, total:10, timeMs:60000 }), prior).speed, 0);
  // fast but low accuracy -> no speed
  assert.equal(computeSessionStars(rec({ correct:7, total:10, timeMs:40000 }), prior).speed, 0);
});

/* ---------- streaks ---------- */
test('consecutive-day streak grants the ongoing bonus and a milestone on crossing 3', () => {
  const prior = [
    rec({ date:'2026-06-08T12:00:00' }),
    rec({ date:'2026-06-09T12:00:00' }),
  ];
  const s = computeSessionStars(rec({ date:'2026-06-10T12:00:00' }), prior);
  assert.equal(s.streakLen, 3);
  assert.equal(s.streak, 1);     // ongoing bonus
  assert.equal(s.milestone, 3);  // crossing 3 days
});

test('a second session the same day does not re-award the milestone', () => {
  const prior = [
    rec({ date:'2026-06-08T12:00:00' }),
    rec({ date:'2026-06-09T12:00:00' }),
    rec({ date:'2026-06-10T09:00:00' }), // already practised today
  ];
  const s = computeSessionStars(rec({ date:'2026-06-10T18:00:00' }), prior);
  assert.equal(s.streakLen, 3);
  assert.equal(s.milestone, 0);  // not the first session today
  assert.equal(s.streak, 1);     // ongoing bonus still applies
});

test('a broken streak resets (gap day) — no streak bonus', () => {
  const prior = [ rec({ date:'2026-06-05T12:00:00' }) ]; // 5 days ago
  const s = computeSessionStars(rec({ date:'2026-06-10T12:00:00' }), prior);
  assert.equal(s.streakLen, 1);
  assert.equal(s.streak, 0);
});

/* ---------- meta helpers ---------- */
test('contextFreeStars = base + accuracy + difficulty only', () => {
  const s = contextFreeStars(rec({ level:5, total:10, correct:10 }));
  assert.equal(s.base, 2);
  assert.equal(s.accuracy, 4);
  assert.equal(s.difficulty, 1);
  assert.equal(s.total, 7);
  assert.equal(s.streak, 0);
  assert.equal(s.pb, 0);
});

test('totalStars sums stored stars and tolerates missing', () => {
  assert.equal(totalStars([{ stars:{ total:5 } }, { stars:{ total:3 } }, {}]), 8);
});

test('currentStreak counts back from today or yesterday', () => {
  const days = ['2026-06-08','2026-06-09','2026-06-10'].map(d=> ({ date:d+'T12:00:00' }));
  assert.equal(currentStreak(days, new Date('2026-06-10T20:00:00')), 3); // practised today
  assert.equal(currentStreak(days, new Date('2026-06-11T08:00:00')), 3); // not today, but yesterday -> alive
  assert.equal(currentStreak(days, new Date('2026-06-12T08:00:00')), 0); // missed a full day
});

test('tier/nextTier progression', () => {
  assert.equal(tierFor(0).name, 'Stargazer');
  assert.equal(tierFor(30).name, 'Comet');
  assert.equal(nextTier(0).at, 25);
  assert.equal(nextTier(300), null);
});
