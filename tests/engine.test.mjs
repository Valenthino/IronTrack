import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTrainingState, workoutDefinition, completeSession, warmupSets, restSeconds, calculatePlates, increment, barWeight } from '../.test-build/engine.js';

function results(state, failed = []) {
  return workoutDefinition(state.nextWorkout).map(({ lift, sets }) => ({
    lift, sets: Array.from({ length: sets }, (_, i) => ({ weight: state.lifts[lift].weight, reps: failed.includes(lift) && i === 0 ? 4 : 5 })),
  }));
}

test('classic definitions and fresh defaults', () => {
  assert.deepEqual(workoutDefinition('A'), ['squat', 'bench_press', 'barbell_row'].map(lift => ({ lift, sets: 5, reps: 5 })));
  assert.deepEqual(workoutDefinition('B'), [{ lift: 'squat', sets: 5, reps: 5 }, { lift: 'overhead_press', sets: 5, reps: 5 }, { lift: 'deadlift', sets: 1, reps: 5 }]);
  assert.equal(createTrainingState('lb').lifts.squat.weight, 45);
});
for (const unit of ['kg', 'lb']) {
  test(`${unit}: completed sessions alternate, progress each successful lift, and share squat`, () => {
    const initial = createTrainingState(unit);
    const snapshot = structuredClone(initial);
    const a = completeSession(initial, results(initial));
    const b = completeSession(a, results(a));
    assert.equal(a.nextWorkout, 'B');
    assert.equal(b.nextWorkout, 'A');
    assert.equal(b.lifts.squat.weight, initial.lifts.squat.weight + 2 * increment(unit));
    assert.equal(b.lifts.deadlift.weight, initial.lifts.deadlift.weight + increment(unit));
    assert.equal(a.lifts.deadlift.weight, initial.lifts.deadlift.weight);
    assert.deepEqual(initial, snapshot);
  });
  test(`${unit}: third consecutive stall deloads and resets counter`, () => {
    let state = createTrainingState(unit);
    state = { ...state, lifts: { ...state.lifts, squat: { weight: 100, stalls: 0 } } };
    for (let i = 1; i <= 3; i++) {
      state = completeSession(state, results(state, ['squat']));
      assert.deepEqual(state.lifts.squat, { weight: i === 3 ? 90 : 100, stalls: i % 3 });
    }
  });
}
test('success interrupts stalls; warmups cannot rescue missed reps or underweight sets', () => {
  let state = createTrainingState('kg');
  state = completeSession(state, results(state, ['squat']));
  assert.equal(state.lifts.squat.stalls, 1);
  state = completeSession(state, results(state));
  assert.equal(state.lifts.squat.stalls, 0);
  const logged = results(state);
  logged[0].sets[0].weight = 0;
  logged[0].sets.push({ weight: 100, reps: 5, warmup: true });
  assert.equal(completeSession(state, logged).lifts.squat.stalls, 1);
});
test('incomplete, duplicate, incorrect and invalid logs are rejected without mutation', () => {
  const state = createTrainingState('kg');
  assert.throws(() => completeSession(state, []));
  const logs = results(state);
  assert.throws(() => completeSession(state, [logs[0], logs[0], logs[2]]));
  logs[0].sets.pop();
  assert.throws(() => completeSession(state, logs));
  for (const bad of [-1, 1.5, NaN, Infinity]) {
    const invalid = results(state);
    invalid[0].sets[0].reps = bad;
    assert.throws(() => completeSession(state, invalid));
  }
});
test('deload rounds to loadable increments and floors at the bar', () => {
  for (const [weight, expected] of [[82.5, 75], [20, 20]]) {
    const base = createTrainingState('kg');
    const state = { ...base, lifts: { ...base.lifts, squat: { weight, stalls: 2 } } };
    assert.equal(completeSession(state, results(state, ['squat'])).lifts.squat.weight, expected);
  }
});
test('warmups ramp below working weight, deduplicate light loads, support custom bars', () => {
  assert.deepEqual(warmupSets(100, 'kg'), [{ weight: 20, reps: 5 }, { weight: 20, reps: 5 }, { weight: 40, reps: 5 }, { weight: 60, reps: 3 }, { weight: 80, reps: 2 }]);
  assert.deepEqual(warmupSets(20, 'kg'), []);
  assert.equal(warmupSets(22.5, 'kg').length, 2);
  assert.deepEqual(warmupSets(135, 'lb').map(s => s.weight), [45, 45, 50, 80, 105]);
  assert.equal(warmupSets(50, 'kg', 15)[0].weight, 15);
  assert.throws(() => warmupSets(10, 'kg'));
});
test('rest defaults are 2–3 minutes', () => {
  assert.equal(restSeconds(), 120);
  assert.equal(restSeconds(true), 180);
});
test('plate calculator gives matched pairs in kg/lb and explicit unloadable remainder', () => {
  assert.deepEqual(calculatePlates(100, 'kg'), { plates: [{ weight: 25, count: 1 }, { weight: 15, count: 1 }], loadedWeight: 100, remainder: 0 });
  assert.deepEqual(calculatePlates(225, 'lb'), { plates: [{ weight: 45, count: 2 }], loadedWeight: 225, remainder: 0 });
  assert.deepEqual(calculatePlates(20, 'kg').plates, []);
  assert.equal(calculatePlates(23, 'kg').remainder, 0.5);
  assert.equal(calculatePlates(49, 'lb').loadedWeight, 45);
  assert.equal(calculatePlates(65, 'kg', 15).loadedWeight, 65);
  for (const value of [-1, NaN, Infinity, 10]) assert.throws(() => calculatePlates(value, 'kg'));
});
test('plate totals conserve weight and never exceed targets across both units', () => {
  for (const unit of ['kg', 'lb']) for (let target = 45; target <= 300; target += 0.5) {
    const result = calculatePlates(target, unit);
    const bar = unit === 'kg' ? 20 : 45;
    assert.equal(bar + result.plates.reduce((n, p) => n + 2 * p.weight * p.count, 0), result.loadedWeight);
    assert.equal(result.loadedWeight + result.remainder, target);
    assert.ok(result.remainder >= 0 && result.remainder < increment(unit));
  }
});
test('invalid units and workouts are rejected consistently across the engine', () => {
  for (const bad of ['stone', 'g', '']) {
    assert.throws(() => increment(bad));
    assert.throws(() => barWeight(bad));
    assert.throws(() => createTrainingState(bad));
    assert.throws(() => calculatePlates(100, bad));
  }
  for (const bad of ['C', 'c', '']) assert.throws(() => workoutDefinition(bad));
});
