import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, makeQuestion, makeSession } from '../src/logic/questions.js';

/* Question generation is random, so we assert INVARIANTS over many runs
   rather than exact values. These guard the rules in the brief. */
const RUNS = 2000;

test('addition under 10: operands 1–9, answer matches', () => {
  for(let i=0;i<RUNS;i++){
    const q = makeQuestion('add10');
    const [a,,b] = q.text.split(' ');
    assert.ok(+a >= 1 && +a <= 9, `a out of range: ${a}`);
    assert.ok(+b >= 1 && +b <= 9, `b out of range: ${b}`);
    assert.equal(q.answer, +a + +b);
  }
});

test('addition under 20: operands 1–19, answer matches', () => {
  for(let i=0;i<RUNS;i++){
    const q = makeQuestion('add20');
    const [a,,b] = q.text.split(' ');
    assert.ok(+a >= 1 && +a <= 19);
    assert.ok(+b >= 1 && +b <= 19);
    assert.equal(q.answer, +a + +b);
  }
});

test('subtraction under 10: answer never below zero', () => {
  for(let i=0;i<RUNS;i++){
    const q = makeQuestion('sub10');
    assert.ok(q.answer >= 0, `negative answer: ${q.text} = ${q.answer}`);
    const [a] = q.text.split(' ');
    assert.ok(+a >= 1 && +a <= 9);
  }
});

test('subtraction under 20: answer never below zero', () => {
  for(let i=0;i<RUNS;i++){
    const q = makeQuestion('sub20');
    assert.ok(q.answer >= 0, `negative answer: ${q.text} = ${q.answer}`);
    const [a] = q.text.split(' ');
    assert.ok(+a >= 1 && +a <= 19);
  }
});

test('multiplication up to 12: operands 1–12, answer matches', () => {
  for(let i=0;i<RUNS;i++){
    const q = makeQuestion('mul12');
    const [a,,b] = q.text.split(' ');
    assert.ok(+a >= 1 && +a <= 12);
    assert.ok(+b >= 1 && +b <= 12);
    assert.equal(q.answer, +a * +b);
  }
});

test('division up to 12: always whole-number answer, divisor 1–12', () => {
  for(let i=0;i<RUNS;i++){
    const q = makeQuestion('div12');
    assert.ok(Number.isInteger(q.answer), `non-integer answer: ${q.text}`);
    assert.ok(q.answer >= 1 && q.answer <= 12);
    const [dividend,,divisor] = q.text.split(' ');
    assert.ok(+divisor >= 1 && +divisor <= 12);
    assert.equal(+dividend % +divisor, 0, `not divisible: ${q.text}`);
    assert.equal(q.answer, +dividend / +divisor);
  }
});

test('makeSession returns the requested number of questions', () => {
  const mixed = LEVELS.find(l=> l.id === 9); // all four operations
  const qs = makeSession(mixed, 10);
  assert.equal(qs.length, 10);
  qs.forEach(q=>{
    assert.equal(typeof q.text, 'string');
    assert.equal(typeof q.answer, 'number');
  });
});
