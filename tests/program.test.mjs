import test from 'node:test';
import assert from 'node:assert/strict';
import { presetProgram, workoutDefinition, workoutName, nextWorkout, completeSession, createTrainingState, validProgram } from '../.test-build/engine.js';
import { initialData, changeProgram, startDraft, setReps, finishWorkout, restoreData, setupTraining } from '../.test-build/flows.js';

function results(state, failed = null) {
  return workoutDefinition(state.nextWorkout, state.program).map(({ lift, sets }) => ({ lift, sets: Array.from({ length: sets }, () => ({ reps: lift === failed ? 4 : 5, weight: state.lifts[lift].weight })) }));
}
function finish(data, id) {
  let draft = startDraft(data.training, id);
  for (const { lift, sets } of workoutDefinition(data.training.nextWorkout, data.training.program)) {
    for (let index = 0; index < sets; index++) draft = setReps(draft, lift, index, 5);
  }
  return finishWorkout({ ...data, draft }, '2026-09-10T12:00:00Z');
}

test('PPL wraps repeatedly and progresses only prescribed lifts in kg and lb', () => {
  for (const unit of ['kg', 'lb']) {
    let state = { ...createTrainingState(unit), program: presetProgram('ppl'), nextWorkout: 'push' };
    const step = unit === 'kg' ? 2.5 : 5;
    for (const expected of ['push', 'pull', 'legs', 'push', 'pull', 'legs']) {
      assert.equal(state.nextWorkout, expected);
      const before = state;
      state = completeSession(state, results(state));
      for (const lift of Object.keys(state.lifts)) {
        assert.equal(state.lifts[lift].weight, before.lifts[lift].weight + (workoutDefinition(expected, state.program).some(item => item.lift === lift) ? step : 0));
      }
    }
    assert.equal(state.nextWorkout, 'push');
  }
});
test('Upper/Lower and one-day custom programs rotate in stored order', () => {
  const program = presetProgram('upper_lower');
  assert.equal(nextWorkout('upper', program), 'lower');
  assert.equal(nextWorkout('lower', program), 'upper');
  const single = { name: 'Custom', daysPerWeek: 2, days: [{ id: 'only', name: 'Full body', lifts: ['deadlift', 'squat'] }] };
  assert.deepEqual(workoutDefinition('only', single).map(item => [item.lift, item.sets]), [['deadlift', 1], ['squat', 5]]);
  assert.equal(nextWorkout('only', single), 'only');
});
test('shared squat progresses across arbitrary days; third stall deloads with microloading', () => {
  let state = { ...createTrainingState('kg'), microloading: true, nextWorkout: 'one', program: { name: 'Squat practice', daysPerWeek: 3, days: ['one', 'two', 'three'].map(id => ({ id, name: id, lifts: ['squat'] })) } };
  state = completeSession(state, results(state));
  assert.equal(state.lifts.squat.weight, 21.25);
  for (let i = 0; i < 3; i++) state = completeSession(state, results(state, 'squat'));
  assert.deepEqual(state.lifts.squat, { weight: 18.75, stalls: 0 });
  assert.equal(state.nextWorkout, 'two');
});
test('rename retains stable day rotation while saved history keeps original names', () => {
  let data = changeProgram(initialData(), presetProgram('ppl'), true);
  data = finish(data, 'push-session');
  const history = JSON.stringify(data.history);
  const renamed = { ...data.training.program, days: data.training.program.days.map(day => ({ ...day, name: `My ${day.name}` })) };
  data = changeProgram(data, renamed);
  assert.equal(data.training.nextWorkout, 'pull');
  assert.equal(workoutName(data.training), 'My Pull');
  assert.equal(workoutName(data.history[0].training), 'Push');
  data = finish(data, 'pull-session');
  assert.equal(workoutName(data.training), 'My Legs');
  assert.equal(JSON.stringify(data.history.slice(1)), history);
  assert.deepEqual(restoreData(JSON.stringify(data)), data);
});
test('preset replacement preserves targets and history, resets rotation, blocks active drafts', () => {
  const data = finish(initialData(), 'classic-session');
  const next = changeProgram(data, presetProgram('ppl'), true);
  assert.equal(next.training.nextWorkout, 'push');
  assert.deepEqual(next.training.lifts, data.training.lifts);
  assert.deepEqual(next.history, data.history);
  assert.throws(() => changeProgram({ ...next, draft: startDraft(next.training, 'active') }, presetProgram('classic'), true), /active workout/);
  assert.deepEqual(restoreData(JSON.stringify(next)), next);
});
test('ordered edits add/remove days and lifts; removing current day restarts at first remaining day', () => {
  let data = changeProgram(initialData(), presetProgram('ppl'), true);
  const program = { ...data.training.program, days: [data.training.program.days[2], { id: 'custom', name: 'Practice', lifts: ['overhead_press', 'squat'] }] };
  data = changeProgram(data, program);
  assert.equal(data.training.nextWorkout, 'legs');
  data = finish(data, 'legs-session');
  assert.equal(data.training.nextWorkout, 'custom');
  assert.deepEqual(workoutDefinition('custom', data.training.program).map(item => item.lift), ['overhead_press', 'squat']);
  data = finish(data, 'custom-session');
  assert.equal(data.training.nextWorkout, 'legs');
});
test('invalid programs and unknown current days fail validation and restore', () => {
  const base = presetProgram('ppl');
  const invalid = [null, {}, { ...base, name: ' ' }, { ...base, days: [] }, ...[0, 8, 2.5].map(daysPerWeek => ({ ...base, daysPerWeek })),
    { ...base, days: [base.days[0], base.days[0]] }, ...[[], ['squat', 'squat'], ['curl']].map(lifts => ({ ...base, days: [{ id: 'push', name: 'Push', lifts }] })),
    { ...base, days: [{ ...base.days[0], name: ' ' }] }];
  for (const program of invalid) {
    assert.equal(validProgram(program), false);
    assert.throws(() => changeProgram(initialData(), program));
    assert.throws(() => restoreData(JSON.stringify({ ...initialData(), training: { ...initialData().training, program } })));
  }
  assert.throws(() => nextWorkout('missing', base));
  assert.throws(() => restoreData(JSON.stringify({ ...initialData(), training: { ...initialData().training, nextWorkout: 'missing' } })));
});
test('v2 migration preserves B draft, reps, equipment, history, profile and schedule', () => {
  let data = finish(initialData(), 'old-session');
  data = { ...data, profile: { experience: 'returning', goal: 'strength', schedule: { daysPerWeek: 4, trainingDays: [0, 1, 3, 5] } }, training: { ...data.training, microloading: true, customBarWeight: 40 } };
  data.draft = { ...setReps(startDraft(data.training, 'old-draft'), 'deadlift', 0, 3), restDeadline: 123456 };
  const legacy = JSON.parse(JSON.stringify(data));
  legacy.version = 2;
  for (const state of [legacy.training, legacy.draft.training, ...legacy.history.map(entry => entry.training)]) delete state.program;
  const restored = restoreData(JSON.stringify(legacy));
  assert.equal(restored.version, 3);
  assert.equal(restored.training.program.name, 'Classic A/B');
  assert.equal(restored.training.program.daysPerWeek, 4);
  assert.equal(restored.training.nextWorkout, 'B');
  assert.deepEqual(restored.training.lifts, data.training.lifts);
  assert.equal(restored.training.customBarWeight, 40);
  assert.equal(restored.training.microloading, true);
  assert.deepEqual(restored.draft.reps, data.draft.reps);
  assert.equal(restored.draft.restDeadline, 123456);
  assert.deepEqual(restored.profile, data.profile);
  assert.deepEqual(restored.history[0].reps, data.history[0].reps);
  assert.equal(restored.history[0].training.nextWorkout, 'A');
  assert.deepEqual(restoreData(JSON.stringify(restored)), restored);
});
test('frequency applies at onboarding and program edits clear only incompatible weekday patterns', () => {
  assert.equal(setupTraining('lb', {}, 4).program.daysPerWeek, 4);
  const data = { ...initialData(), profile: { experience: 'new', goal: 'strength', schedule: { daysPerWeek: 3, trainingDays: [0, 2, 4] } } };
  assert.deepEqual(changeProgram(data, presetProgram('ppl')).profile, data.profile);
  const changed = changeProgram(data, { ...presetProgram('ppl'), daysPerWeek: 6 });
  assert.deepEqual(changed.profile, { experience: 'new', goal: 'strength' });
  assert.equal(changed.training.program.daysPerWeek, 6);
  assert.deepEqual(restoreData(JSON.stringify(changed)), changed);
});
test('saved programs are detached from mutable editor input', () => {
  const program = presetProgram('ppl');
  const saved = changeProgram(initialData(), program, true);
  program.days[0].name = 'Changed';
  program.days[0].lifts.reverse();
  assert.equal(workoutName(saved.training), 'Push');
  assert.deepEqual(workoutDefinition('push', saved.training.program).map(item => item.lift), ['bench_press', 'overhead_press']);
});
