/* localStorage key scheme — pure string helpers, no localStorage access.

   Session keys are `ms_sessions_<enc(family)>|<enc(player)>`. The '|'
   delimiter distinguishes them from legacy pre-family keys, which were
   `ms_sessions_<player>` with no delimiter. */

export const SESSION_PREFIX = 'ms_sessions_';
export const enc = s => encodeURIComponent(s || 'default');

/* Storage key for one (family, player) pair. */
export function sessionKey(family, player){
  return SESSION_PREFIX + enc(family) + '|' + enc(player);
}

/* Prefix that all of a family's session keys share. */
export function familyPrefix(family){
  return SESSION_PREFIX + enc(family) + '|';
}

export function isSessionKey(k){
  return typeof k === 'string' && k.startsWith(SESSION_PREFIX);
}

/* Legacy keys are pre-family: `ms_sessions_<player>` with no '|'. */
export function isLegacySessionKey(k){
  return isSessionKey(k) && !k.slice(SESSION_PREFIX.length).includes('|');
}

/* The raw (un-encoded) player name stored in a legacy key. */
export function legacyPlayer(k){
  return k.slice(SESSION_PREFIX.length);
}
