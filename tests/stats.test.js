import test from 'node:test';
import assert from 'node:assert/strict';
import { bestForLevel, fmtTime } from '../src/logic/stats.js';

test('bestForLevel picks the most-correct session for that level', () => {
  const sessions = [
    { level:5, correct:6, timeMs:30000 },
    { level:5, correct:9, timeMs:50000 },
    { level:3, correct:10, timeMs:10000 }, // different level, ignored
  ];
  assert.equal(bestForLevel(5, sessions).correct, 9);
});

test('bestForLevel breaks ties by fastest time', () => {
  const sessions = [
    { level:5, correct:8, timeMs:40000 },
    { level:5, correct:8, timeMs:25000 }, // same score, faster
  ];
  assert.equal(bestForLevel(5, sessions).timeMs, 25000);
});

test('bestForLevel returns null when the level has no sessions', () => {
  assert.equal(bestForLevel(5, [{ level:1, correct:10, timeMs:1000 }]), null);
  assert.equal(bestForLevel(5, []), null);
});

test('fmtTime formats sub-minute as seconds and over a minute as m:ss', () => {
  assert.equal(fmtTime(42000), '42s');
  assert.equal(fmtTime(65000), '1:05');
  assert.equal(fmtTime(125000), '2:05');
  assert.equal(fmtTime(0), '0s');
});
