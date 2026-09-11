import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialData, restoreData, schedulePatterns, setupTraining, startingWeightHint, validSchedule, lifts } from '../.test-build/flows.js';

test('every onboarding schedule pattern matches its frequency and survives local restore', () => {
  for (const days of [2, 3, 4]) for (const trainingDays of schedulePatterns[days]) {
    const schedule = { daysPerWeek: days, trainingDays };
    assert.equal(validSchedule(schedule), true);
    const data = { ...initialData(), profile: { experience: 'returning', goal: 'size', schedule } };
    assert.deepEqual(restoreData(JSON.stringify(data)), data);
  }
});
test('legacy profiles restore without adding or requiring a schedule', () => {
  const data = { ...initialData(), profile: { experience: 'experienced', goal: 'confidence' } };
  assert.deepEqual(restoreData(JSON.stringify(data)), data);
});
test('malformed persisted schedules are rejected', () => {
  for (const schedule of [null, {}, { daysPerWeek: 5, trainingDays: [0, 1, 2, 3, 4] }, { daysPerWeek: 2, trainingDays: [0] }, { daysPerWeek: 2, trainingDays: [0, 0] }, { daysPerWeek: 2, trainingDays: [-1, 4] }, { daysPerWeek: 2, trainingDays: [0, 7] }, { daysPerWeek: 2, trainingDays: [0, 1.5] }, { daysPerWeek: 2, trainingDays: ['0', 3] }]) {
    assert.equal(validSchedule(schedule), false);
    assert.throws(() => restoreData(JSON.stringify({ ...initialData(), profile: { experience: 'new', goal: 'strength', schedule } })));
  }
});
test('hints use experience, goal and lift without replacing empty-bar defaults', () => {
  for (const lift of lifts) {
    const experienceHints = new Set();
    const goalHints = new Set();
    for (const experience of ['new', 'returning', 'experienced']) {
      experienceHints.add(startingWeightHint(experience, 'strength', lift));
      for (const goal of ['strength', 'size', 'confidence']) {
        goalHints.add(startingWeightHint('new', goal, lift));
        assert.ok(startingWeightHint(experience, goal, lift).length > 0);
        assert.equal(setupTraining('lb', {}).lifts[lift].weight, 45);
        assert.equal(setupTraining('kg', {}).lifts[lift].weight, 20);
      }
    }
    assert.equal(experienceHints.size, 3);
    assert.equal(goalHints.size, 3);
  }
  assert.equal(new Set(lifts.map(lift => startingWeightHint('new', 'strength', lift))).size, 5);
});
