/* Storage schema versioning — pure record migrations, no DOM/localStorage.
   See DECISIONS.md #2 for the rationale (local re-stamps, cloud normalizes
   on read). The localStorage-touching parts (STORE_MIGRATIONS,
   runLocalMigrations, adoptLegacyData) live in app.js, not here. */

export const SCHEMA_VERSION = 3;   // bump whenever the record shape changes

/* ---------- Per-record migrations ----------------------------------
   Each entry upgrades a record FROM the previous version TO `to`.
   Prefer additive/defensive changes. Applied by normalizeRecord()
   for BOTH local and cloud reads, so the app only ever sees current
   shape — old devices reading new docs just re-normalize in memory. */
export const RECORD_MIGRATIONS = [
  {
    to: 2,
    up(r){
      return {
        ...r,
        questions: Array.isArray(r.questions) ? r.questions : [],
        accuracy: r.total ? r.correct / r.total : 0,
      };
    },
  },
  {
    to: 3,
    up(r){
      // Introduce family grouping. Pre-family records default to 'default'
      // family (they were all effectively one household before this).
      return { ...r, family: r.family || 'default' };
    },
  },
];

/* Upgrade ONE record to current schema, in memory. Never throws. */
export function normalizeRecord(rec){
  if(!rec || typeof rec !== 'object') return null;
  let v = rec.schemaVersion || 1;          // pre-versioned data is treated as v1
  let out = rec;
  for(const m of RECORD_MIGRATIONS){
    if(m.to > v){
      try{ out = m.up(out); v = m.to; }
      catch(e){ console.warn('record migration to v'+m.to+' failed:', e); break; }
    }
  }
  out.schemaVersion = v;
  return out;
}

export function normalizeRecords(list){
  return (Array.isArray(list) ? list : []).map(normalizeRecord).filter(Boolean);
}
