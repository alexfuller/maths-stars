import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION_PREFIX, enc, sessionKey, familyPrefix,
  isSessionKey, isLegacySessionKey, legacyPlayer,
} from '../src/logic/storage-keys.js';

test('sessionKey encodes family and player and joins with "|"', () => {
  assert.equal(sessionKey('Smiths', 'Maya'), 'ms_sessions_Smiths|Maya');
  // special characters are URL-encoded so the "|" delimiter stays unambiguous
  assert.equal(sessionKey('A|B', 'x y'), 'ms_sessions_A%7CB|x%20y');
});

test('enc and keys fall back to "default" for empty values', () => {
  assert.equal(enc(''), 'default');
  assert.equal(sessionKey('', ''), 'ms_sessions_default|default');
});

test('familyPrefix matches that family\'s session keys only', () => {
  const prefix = familyPrefix('Smiths');
  assert.equal(prefix, 'ms_sessions_Smiths|');
  assert.ok(sessionKey('Smiths', 'Maya').startsWith(prefix));
  assert.ok(!sessionKey('Jones', 'Maya').startsWith(prefix));
});

test('legacy keys (no "|") are detected; new keys are not legacy', () => {
  assert.ok(isLegacySessionKey('ms_sessions_Maya'));
  assert.ok(!isLegacySessionKey(sessionKey('Smiths', 'Maya')));
  assert.ok(!isLegacySessionKey('ms_qcount'));      // not a session key at all
  assert.equal(legacyPlayer('ms_sessions_Maya'), 'Maya');
});

test('isSessionKey only matches the session prefix', () => {
  assert.ok(isSessionKey(SESSION_PREFIX + 'x'));
  assert.ok(!isSessionKey('ms_family'));
  assert.ok(!isSessionKey(null));
});
