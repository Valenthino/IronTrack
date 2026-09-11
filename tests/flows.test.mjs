import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeEquipment, changeUnit, draftComplete, finishWorkout, initialData as defaultData, lifts, remainingSeconds, restoreData, setReps, setupTraining, startDraft, validEmail } from '../.test-build/flows.js';
import { workoutDefinition } from '../.test-build/engine.js';
function initialData() { return { ...defaultData(), training: setupTraining('kg', {}) }; }
test('new installations default to pounds without reinterpreting existing kg data', () => {
  assert.equal(defaultData().training.unit, 'lb');
  assert.equal(defaultData().training.lifts.squat.weight, 45);
  assert.equal(restoreData(JSON.stringify(initialData())).training.unit, 'kg');
});
function logged(data, missed = false) {
  let draft = startDraft(data.training, 'session-1');
  for (const { lift, sets } of workoutDefinition(data.training.nextWorkout)) for (let i = 0; i < sets; i++) draft = setReps(draft, lift, i, missed && lift === 'squat' ? 4 : 5);
  return { ...data, draft };
}
test('onboarding defaults each lift to nominal bars; custom weights accept any nonnegative load', () => {
  for (const [unit, bar] of [['kg', 20], ['lb', 45]]) {
    const state = setupTraining(unit, { squat: ' ' });
    assert.ok(lifts.every(lift => state.lifts[lift].weight === bar));
  }
  assert.equal(setupTraining('kg', { squat: '62.5' }).lifts.squat.weight, 62.5);
  for (const value of ['abc', '-1', 'Infinity']) assert.throws(() => setupTraining('kg', { squat: value }));
});
test('set editing is immutable, zero reps counts as attempted, clear makes session incomplete', () => {
  const data = initialData();
  const draft = startDraft(data.training, '1');
  const edited = setReps(draft, 'squat', 0, 0);
  assert.equal(draft.reps.squat[0], null);
  assert.equal(edited.reps.squat[0], 0);
  assert.equal(draftComplete(edited), false);
  for (const value of [-1, 6, 1.5, NaN]) assert.throws(() => setReps(draft, 'squat', 0, value));
  assert.throws(() => setReps(draft, 'deadlift', 0, 5));
  assert.throws(() => setReps(draft, 'squat', 5, 5));
  const full = logged(data).draft;
  assert.equal(draftComplete(full), true);
  assert.equal(draftComplete(setReps(full, 'squat', 0, null)), false);
});
test('finishing atomically stores original targets/reps, advances engine, and clears draft', () => {
  const data = logged(initialData(), true);
  const snapshot = structuredClone(data);
  const next = finishWorkout(data, '2026-09-09T12:00:00.000Z');
  assert.equal(next.draft, null);
  assert.equal(next.training.nextWorkout, 'B');
  assert.equal(next.training.lifts.squat.weight, 20);
  assert.equal(next.training.lifts.squat.stalls, 1);
  assert.equal(next.training.lifts.bench_press.weight, 22.5);
  assert.equal(next.history[0].training.lifts.bench_press.weight, 20);
  assert.deepEqual(data, snapshot);
  assert.throws(() => finishWorkout(next, '2026-09-09'));
  assert.throws(() => finishWorkout({ ...next, draft: data.draft }, '2026-09-09'), /already saved/);
  assert.throws(() => finishWorkout({ ...data, draft: startDraft(data.training, '2') }, '2026-09-09'), /every working set/);
});
test('workout B has one deadlift set and can finalize after all 11 sets', () => {
  const data = initialData();
  data.training = { ...data.training, nextWorkout: 'B' };
  const complete = logged(data);
  assert.equal(complete.draft.reps.deadlift.length, 1);
  assert.equal(finishWorkout(complete, '2026-09-09').training.nextWorkout, 'A');
});
test('unit change converts current weights, preserves stalls/history, and blocks active sessions', () => {
  const completed = finishWorkout(logged(initialData(), true), '2026-09-09');
  const changed = changeUnit(completed, 'lb');
  assert.equal(changed.training.lifts.squat.weight, 45);
  assert.equal(changed.training.lifts.squat.stalls, 1);
  assert.equal(changed.training.lifts.bench_press.weight, 50);
  assert.equal(changed.history, completed.history);
  assert.equal(changed.history[0].training.unit, 'kg');
  assert.equal(changeUnit(changed, 'lb'), changed);
  assert.throws(() => changeUnit(logged(initialData()), 'lb'));
});
test('local restore supports drafts and history; rejects damaged or unsupported data', () => {
  const data = logged(initialData());
  assert.deepEqual(restoreData(JSON.stringify(data)), data);
  const done = finishWorkout(data, '2026-09-09');
  assert.deepEqual(restoreData(JSON.stringify(done)), done);
  for (const bad of ['null', '{}', '{', JSON.stringify({ ...data, version: 3 }), JSON.stringify({ ...data, training: { ...data.training, unit: 'stone' } }), JSON.stringify({ ...data, draft: { ...data.draft, reps: {} } })]) assert.throws(() => restoreData(bad));
});
test('rest deadline recovers elapsed time without negative countdowns', () => {
  assert.equal(remainingSeconds(null, 0), 0);
  assert.equal(remainingSeconds(120000, 0), 120);
  assert.equal(remainingSeconds(120000, 60001), 60);
  assert.equal(remainingSeconds(120000, 150000), 0);
});
test('magic-link email validation rejects empty and malformed input', () => {
  assert.equal(validEmail(' athlete@example.com '), true);
  for (const value of ['', 'abc', 'a@b', 'a b@example.com', 'a@@example.com']) assert.equal(validEmail(value), false);
});
test('rest deadlines round-trip and inconsistent persisted sessions are rejected', () => {
  const data = logged(initialData());
  data.draft.restDeadline = 180000;
  assert.equal(restoreData(JSON.stringify(data)).draft.restDeadline, 180000);
  const invalid = structuredClone(data);
  invalid.draft.training.nextWorkout = 'B';
  assert.throws(() => restoreData(JSON.stringify(invalid)));
  const done = finishWorkout(data, '2026-09-09');
  assert.throws(() => restoreData(JSON.stringify({ ...done, history: [done.history[0], done.history[0]] })));
});

test('setup and restore reject negative or nonfinite targets', () => {
  for (const weight of [-1, Infinity, NaN]) {
    assert.throws(() => setupTraining('lb', { squat: String(weight) }));
    const data = defaultData();
    data.training.lifts.squat.weight = weight;
    assert.throws(() => restoreData(JSON.stringify(data)));
  }
});

test('zero, subbar and fractional weights survive setup, completion and restore', () => {
  for (const unit of ['kg', 'lb']) for (const weight of [0, 1, 19, 21, 46, 1.25]) {
    const data = { ...defaultData(), training: setupTraining(unit, { squat: String(weight) }) };
    assert.equal(data.training.lifts.squat.weight, weight);
    const done = finishWorkout(logged(data), '2026-09-09');
    assert.equal(restoreData(JSON.stringify(done)).history[0].training.lifts.squat.weight, weight);
  }
});
test('unit conversion retains zero and subbar targets and snaps with the toggle', () => {
  for (const microloading of [false, true]) {
    const data = changeEquipment({ ...defaultData(), training: setupTraining('lb', { squat: '0', bench_press: '10' }) }, microloading, 40);
    const converted = changeUnit(data, 'kg');
    assert.equal(converted.training.lifts.squat.weight, 0);
    assert.equal(converted.training.lifts.bench_press.weight, 5);
    assert.equal(converted.training.customBarWeight, 18.1436948);
    const other = changeUnit({ ...data, training: { ...data.training, lifts: { ...data.training.lifts, squat: { weight: 8, stalls: 0 } } } }, 'kg');
    assert.equal(other.training.lifts.squat.weight, microloading ? 3.75 : 2.5);
  }
});
test('equipment settings persist without altering targets or history and block active drafts', () => {
  const data = finishWorkout(logged(initialData()), '2026-09-09');
  const changed = changeEquipment(data, true, 40);
  assert.equal(changed.training.lifts, data.training.lifts);
  assert.equal(changed.history, data.history);
  assert.deepEqual(restoreData(JSON.stringify(changed)), changed);
  assert.equal(changeEquipment(changed, false, 0).training.customBarWeight, 0);
  assert.equal(changeEquipment(changed, false, null).training.customBarWeight, null);
  assert.throws(() => changeEquipment(logged(initialData()), true, 40));
  for (const bar of [-1, NaN, Infinity]) assert.throws(() => changeEquipment(data, true, bar));
  for (const patch of [{ microloading: 'yes' }, { customBarWeight: -1 }, { customBarWeight: '40' }]) {
    assert.throws(() => restoreData(JSON.stringify({ ...changed, training: { ...changed.training, ...patch } })));
  }
});
test('v1 migration preserves all lift values, history, active reps and rest deadlines', () => {
  const done = finishWorkout(logged(initialData(), true), '2026-09-09');
  const current = { ...done, draft: startDraft(done.training, 'session-2') };
  current.draft = setReps(current.draft, 'squat', 0, 3);
  current.draft.restDeadline = 180000;
  const legacy = JSON.parse(JSON.stringify(current));
  legacy.version = 1;
  for (const state of [legacy.training, legacy.draft.training, ...legacy.history.map(entry => entry.training)]) {
    delete state.microloading;
    delete state.customBarWeight;
  }
  const raw = JSON.stringify(legacy);
  const migrated = restoreData(raw);
  assert.deepEqual(migrated, current);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.training.microloading, false);
  assert.equal(migrated.training.customBarWeight, null);
  assert.deepEqual(restoreData(JSON.stringify(migrated)), migrated);
  assert.equal(JSON.stringify(legacy), raw);
  assert.throws(() => restoreData(JSON.stringify({ ...legacy, training: { ...legacy.training, lifts: {} } })));
});
