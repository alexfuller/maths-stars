/* Star rewards — pure logic, no DOM. Computes how many stars a session
   earns, plus streak/total helpers for the night-sky meta. All tunable
   numbers live in STAR_CONFIG so the "feel" is one edit away.

   Design: stars are computed at session finish using the player's prior
   history (for PB / speed / streak / first-try) and STORED on the record.
   A player's total is the sum of each session's stars.total — no separate
   mutable balance. See DECISIONS.md #5. */

export const STAR_CONFIG = {
  basePer: 5,            // base = round(total / basePer), min 1  → 10q:2, 20q:4
  accuracyBands: [       // first band whose `min` is met (descending order)
    { min: 1.00, stars: 4 },
    { min: 0.90, stars: 3 },
    { min: 0.80, stars: 2 },
    { min: 0.70, stars: 1 },
  ],
  speedStars: 1,
  speedWindow: 1.10,     // avg time/q within 10% of your best for the level
  speedMinAccuracy: 0.90,
  pbStars: 2,            // beat your prior best for the level
  firstTryStars: 1,      // first ever attempt at a level
  difficulty: { add_sub: 0, mul_div: 1, mixed: 2 }, // by level id
  streakStars: 1,        // ongoing daily streak >= streakMin days
  streakMin: 2,
  milestones: { 3: 3, 7: 5, 14: 10, 30: 20 },       // one-time, on crossing
};

/* Collectible tiers for the night sky (total stars). */
export const STAR_TIERS = [
  { at: 0,   name: 'Stargazer' },
  { at: 25,  name: 'Comet' },
  { at: 75,  name: 'Constellation' },
  { at: 150, name: 'Galaxy' },
  { at: 300, name: 'Supernova' },
];
export function tierFor(total){
  let t = STAR_TIERS[0];
  for(const x of STAR_TIERS){ if(total >= x.at) t = x; }
  return t;
}
export function nextTier(total){
  return STAR_TIERS.find(x=> x.at > total) || null;
}

/* ---------- small helpers ---------- */
function baseStars(total){ return Math.max(1, Math.round((total||0) / STAR_CONFIG.basePer)); }
function accuracyStars(acc){
  for(const b of STAR_CONFIG.accuracyBands){ if(acc >= b.min) return b.stars; }
  return 0;
}
export function difficultyStars(level){
  if(level >= 7) return STAR_CONFIG.difficulty.mixed;
  if(level >= 5) return STAR_CONFIG.difficulty.mul_div;
  return STAR_CONFIG.difficulty.add_sub;
}
function bestOf(sessions){
  // most correct, tie-broken by fastest time (matches stats.bestForLevel)
  let best = sessions[0];
  for(const s of sessions){
    if(s.correct > best.correct || (s.correct === best.correct && s.timeMs < best.timeMs)) best = s;
  }
  return best;
}

/* ---------- date / streak helpers ---------- */
const pad = n => String(n).padStart(2,'0');
function dayKey(dateStr){
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function prevDay(key){
  const [y,m,d] = key.split('-').map(Number);
  const dt = new Date(y, m-1, d); dt.setDate(dt.getDate()-1);
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
}
function streakEndingAt(daySet, key){
  let c = 0, k = key;
  while(daySet.has(k)){ c++; k = prevDay(k); }
  return c;
}

/* Current live streak for display: consecutive days ending today if the
   player practised today, else ending yesterday (a streak stays "alive"
   until a full day is missed). */
export function currentStreak(sessions, asOf = new Date()){
  const daySet = new Set(sessions.map(s=> dayKey(s.date)).filter(Boolean));
  const today = dayKey(asOf);
  if(daySet.has(today)) return streakEndingAt(daySet, today);
  const y = prevDay(today);
  if(daySet.has(y)) return streakEndingAt(daySet, y);
  return 0;
}

/* ---------- the core ---------- */

/* Full star breakdown for a finished session, given the same player's
   EARLIER sessions (any level, current session excluded). */
export function computeSessionStars(record, prior = []){
  const total = record.total || 0;
  const acc = total ? (record.correct || 0) / total : 0;
  const priorLevel = prior.filter(s=> s.level === record.level);
  const firstTry = priorLevel.length === 0;

  const base = baseStars(total);
  const accuracy = accuracyStars(acc);
  const difficulty = difficultyStars(record.level);
  const firstTryStars = firstTry ? STAR_CONFIG.firstTryStars : 0;

  let pb = 0, speed = 0;
  if(!firstTry){
    const best = bestOf(priorLevel);
    if(record.correct > best.correct || (record.correct === best.correct && record.timeMs < best.timeMs)){
      pb = STAR_CONFIG.pbStars;
    }
    if(acc >= STAR_CONFIG.speedMinAccuracy){
      const bestAvg = Math.min(...priorLevel.map(s=> s.timeMs / (s.total || 1)));
      if((record.timeMs / (total || 1)) <= bestAvg * STAR_CONFIG.speedWindow) speed = STAR_CONFIG.speedStars;
    }
  }

  // streak: count this session's day plus prior days
  const priorDays = new Set(prior.map(s=> dayKey(s.date)).filter(Boolean));
  const today = dayKey(record.date);
  const firstSessionToday = !priorDays.has(today);
  const daySet = new Set(priorDays); daySet.add(today);
  const streakLen = streakEndingAt(daySet, today);
  const streak = streakLen >= STAR_CONFIG.streakMin ? STAR_CONFIG.streakStars : 0;
  // milestone only on the first session of the day, so replays don't double-award
  const milestone = firstSessionToday ? (STAR_CONFIG.milestones[streakLen] || 0) : 0;

  const parts = { base, accuracy, speed, pb, firstTry: firstTryStars, difficulty, streak, milestone };
  const totalEarned = Object.values(parts).reduce((a,b)=> a+b, 0);
  return { ...parts, total: totalEarned, streakLen };
}

/* Context-free estimate (base + accuracy + difficulty only) for legacy /
   old-client records that lack stored stars. Used by the schema v4
   migration — streak/PB/speed can't be known without cross-session replay,
   so they're omitted honestly. */
export function contextFreeStars(record){
  const total = record.total || 0;
  const acc = total ? (record.correct || 0) / total : 0;
  const base = baseStars(total);
  const accuracy = accuracyStars(acc);
  const difficulty = difficultyStars(record.level);
  return { base, accuracy, speed:0, pb:0, firstTry:0, difficulty, streak:0, milestone:0, total: base+accuracy+difficulty };
}

/* Sum of stored stars across sessions. */
export function totalStars(sessions){
  return sessions.reduce((a,s)=> a + ((s.stars && s.stars.total) || 0), 0);
}
