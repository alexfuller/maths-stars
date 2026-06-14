import test from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA_VERSION, normalizeRecord, normalizeRecords } from '../src/logic/schema.js';

test('a pre-versioned (v1) record upgrades to current schema', () => {
  const v1 = { profile:'Maya', level:5, total:10, correct:8, timeMs:42000, date:'2026-06-01' };
  const out = normalizeRecord(v1);
  assert.equal(out.schemaVersion, SCHEMA_VERSION);
  assert.equal(out.family, 'default');        // v3 default
  assert.equal(out.accuracy, 0.8);            // v2 derived field
  assert.deepEqual(out.questions, []);        // v2 defaulted missing array
  // original fields preserved
  assert.equal(out.profile, 'Maya');
  assert.equal(out.correct, 8);
});

test('normalizeRecord is idempotent (re-normalizing changes nothing)', () => {
  const once = normalizeRecord({ profile:'A', total:5, correct:5 });
  const twice = normalizeRecord({ ...once });
  assert.deepEqual(twice, once);
});

test('an existing family is not overwritten by the v3 default', () => {
  const out = normalizeRecord({ schemaVersion:2, family:'Smiths', total:4, correct:2, questions:[] });
  assert.equal(out.family, 'Smiths');
  assert.equal(out.schemaVersion, SCHEMA_VERSION);
});

test('accuracy guards divide-by-zero when total is 0', () => {
  const out = normalizeRecord({ total:0, correct:0 });
  assert.equal(out.accuracy, 0);
});

test('normalizeRecords drops junk entries and tolerates non-arrays', () => {
  const list = [ {total:2,correct:1}, null, 'nope', 42, {total:4,correct:4} ];
  const out = normalizeRecords(list);
  assert.equal(out.length, 2);
  assert.deepEqual(normalizeRecords(undefined), []);
  assert.deepEqual(normalizeRecords('x'), []);
});
