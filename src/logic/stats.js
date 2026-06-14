/* Stats / formatting helpers — pure, no DOM. */

/* Best session for a level: most correct, tie-broken by fastest time.
   Returns null when the level has no sessions. */
export function bestForLevel(levelId, sessions){
  const ls = sessions.filter(s=> s.level===levelId);
  if(!ls.length) return null;
  let best = ls[0];
  ls.forEach(s=>{ if(s.correct>best.correct || (s.correct===best.correct && s.timeMs<best.timeMs)) best=s; });
  return best;
}

/* Human-friendly duration: "1:05" for >= 1 min, else "42s". */
export function fmtTime(ms){
  const s=Math.round(ms/1000);
  const m=Math.floor(s/60), r=s%60;
  return m>0 ? `${m}:${String(r).padStart(2,'0')}` : `${r}s`;
}
