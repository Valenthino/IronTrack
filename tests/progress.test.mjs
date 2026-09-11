import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const p = require('../.test-build/progress.js');
const f = require('../.test-build/flows.js');
function session(id, date, weight = 45, reps = 5, unit = 'lb', stalls = 0) {
  let data = f.initialData();
  data.training = f.setupTraining(unit, { squat: String(weight) });
  data.training.lifts.squat.stalls = stalls;
  let draft = f.startDraft(data.training, id);
  for (const lift of Object.keys(draft.reps)) draft.reps[lift] = draft.reps[lift].map(() => reps);
  return f.finishWorkout({ ...data, draft }, `${date}T12:00:00`).history[0];
}
test('progress sorts without mutation and only includes performed lifts', () => {
  const history = [session('b', '2026-09-09', 50), session('a', '2026-09-07')];
  const before = JSON.stringify(history);
  assert.deepEqual(p.liftProgress(history, 'squat', 'lb').map(x => x.id), ['a', 'b']);
  assert.deepEqual(p.liftProgress(history, 'deadlift', 'lb'), []);
  assert.equal(JSON.stringify(history), before);
});
test('PR is null when empty or all attempts have zero reps; positive reps qualify', () => {
  assert.equal(p.personalRecord([], 'squat', 'lb'), null);
  assert.equal(p.personalRecord([session('a', '2026-09-07', 100, 0)], 'squat', 'lb'), null);
  assert.equal(p.personalRecord([session('a', '2026-09-07', 100, 0), session('b', '2026-09-08', 50, 1)], 'squat', 'lb'), 50);
  assert.equal(p.personalRecord([session('a', '2026-09-07', 0)], 'squat', 'lb'), 0);
});
test('PR compares mixed units and retains all-time max after a deload', () => {
  const history = [session('a', '2026-09-07', 100), session('b', '2026-09-08', 50, 5, 'kg'), session('c', '2026-09-09', 40, 5, 'kg')];
  assert.equal(p.personalRecord(history, 'squat', 'kg'), 50);
  assert.ok(Math.abs(p.personalRecord(history, 'squat', 'lb') - 110.23113109) < 1e-7);
  assert.equal(p.convertWeight(20, 'kg', 'kg'), 20);
});
test('history outcome uses saved pre-session stalls, including success resetting stalls', () => {
  for (let stalls = 0; stalls < 3; stalls++) assert.match(p.liftOutcome(session('a', '2026-09-07', 50, 4, 'lb', stalls), 'squat'), stalls === 2 ? /Deload triggered/ : new RegExp(`Stall ${stalls + 1}/3`));
  assert.equal(p.liftOutcome(session('a', '2026-09-07', 50, 5, 'lb', 2), 'squat'), 'Completed');
});
test('notes save through draft completion and edit only selected history metadata', () => {
  let data = f.initialData(); data.draft = f.startDraft(data.training, 'draft');
  data = p.saveNote(data, 'draft', 'Felt good\nNext time: steady reps.');
  for (const lift of Object.keys(data.draft.reps)) data.draft.reps[lift].fill(5);
  data = f.finishWorkout(data, '2026-09-07T12:00:00Z');
  assert.match(data.history[0].notes, /Felt good/);
  const before = JSON.stringify(data.training);
  const updated = p.saveNote(data, 'draft', 'Revised');
  assert.equal(updated.history[0].notes, 'Revised');
  assert.match(data.history[0].notes, /Felt good/);
  assert.equal(JSON.stringify(updated.training), before);
  assert.equal(f.restoreData(JSON.stringify(updated)).history[0].notes, 'Revised');
  assert.throws(() => p.saveNote(data, 'missing', 'test'));
  assert.throws(() => p.saveNote(data, 'draft', 'x'.repeat(2001)));
});
test('bodyweight replaces same date, sorts dates, keeps recorded units and roundtrips', () => {
  const original = f.initialData();
  let data = p.logBodyweight(original, { date: '2026-09-09', weight: 80, unit: 'kg' });
  data = p.logBodyweight(data, { date: '2026-09-08', weight: 180, unit: 'lb' });
  data = p.logBodyweight(data, { date: '2026-09-09', weight: 81, unit: 'kg' });
  assert.equal(original.bodyweight, undefined);
  assert.deepEqual(data.bodyweight.map(x => x.weight), [180, 81]);
  assert.deepEqual(f.restoreData(JSON.stringify(data)), data);
});
test('bodyweight rejects invalid and nonfinite input and impossible dates', () => {
  for (const weight of [0, -1, NaN, Infinity]) assert.throws(() => p.logBodyweight(f.initialData(), { date: '2026-09-07', weight, unit: 'kg' }));
  for (const date of ['2026-02-29', '2026-13-01', '2026-04-31', '2026-1-01', 'bad']) assert.equal(p.validDate(date), false);
  assert.equal(p.validDate('2024-02-29'), true);
});
test('calendar uses Monday columns, leap days and year rollover', () => {
  const feb = p.monthGrid(2024, 1);
  assert.deepEqual(feb[0].slice(0, 4), [null, null, null, '2024-02-01']);
  assert.equal(feb.flat().filter(Boolean).length, 29);
  assert.equal(p.monthGrid(2026, 12).flat().find(Boolean), '2027-01-01');
  for (let month = 0; month < 12; month++) assert.ok(p.monthGrid(2026, month).every(week => week.length === 7));
});
test('streak tolerates rest days and unfinished current week then breaks after missed week', () => {
  const history = ['2026-08-31', '2026-09-02', '2026-09-04'].map((date, i) => session(String(i), date));
  assert.equal(p.trainingStreak(history, 3, new Date('2026-09-06T20:00:00')), 1);
  assert.equal(p.trainingStreak(history, 3, new Date('2026-09-10T20:00:00')), 1);
  assert.equal(p.trainingStreak(history, 3, new Date('2026-09-14T00:00:00')), 0);
});
test('streak counts distinct training days, excludes future sessions, and crosses year boundary', () => {
  const history = ['2025-12-29', '2025-12-31', '2026-01-02', '2026-01-05', '2026-01-07', '2026-01-09'].map((date, i) => session(String(i), date));
  assert.equal(p.trainingStreak(history, 3, new Date('2026-01-10T12:00:00')), 2);
  assert.equal(p.trainingStreak(history, 3, new Date('2026-01-07T10:00:00')), 1);
  assert.equal(p.trainingStreak([history[0], { ...history[0], id: 'duplicate' }], 2, new Date('2026-01-04T12:00:00')), 0);
  assert.equal(p.trainingStreak([], 3, new Date()), 0);
  assert.throws(() => p.trainingStreak([], 0, new Date()));
});
test('reminders use local weekday/time, support disabled and midnight boundaries', () => {
  const data = { ...f.initialData(), reminder: { enabled: true, days: [0], time: '18:00' } };
  assert.equal(p.reminderDue(data, new Date('2026-09-07T17:59:59')), false);
  assert.equal(p.reminderDue(data, new Date('2026-09-07T18:00:00')), true);
  assert.equal(p.reminderDue(data, new Date('2026-09-08T00:00:00')), false);
  assert.equal(p.reminderDue({ ...data, reminder: { ...data.reminder, enabled: false } }, new Date('2026-09-07T18:00:00')), false);
});
test('reminders suppress active/completed sessions and dismissal expires on next selected day', () => {
  const data = { ...f.initialData(), reminder: { enabled: true, days: [0, 2], time: '00:00', dismissed: '2026-09-07' } };
  assert.equal(p.reminderDue(data, new Date('2026-09-07T18:00:00')), false);
  const now = new Date('2026-09-09T18:00:00');
  assert.equal(p.reminderDue(data, now), true);
  assert.equal(p.reminderDue({ ...data, draft: f.startDraft(data.training, 'a') }, now), false);
  assert.equal(p.reminderDue({ ...data, history: [session('a', '2026-09-09')] }, now), false);
});
test('reminder validation rejects empty/duplicate/out-of-range days and malformed times', () => {
  for (const days of [[], [0, 0], [-1], [7], [0.5]]) assert.throws(() => p.saveReminder(f.initialData(), { enabled: true, days, time: '18:00' }));
  for (const time of ['24:00', '12:60', '6:00', 'abc']) assert.throws(() => p.saveReminder(f.initialData(), { enabled: true, days: [0], time }));
  const reminder = { enabled: true, days: [0], time: '00:00' };
  const data = p.saveReminder(f.initialData(), reminder); reminder.days.push(1);
  assert.deepEqual(data.reminder.days, [0]);
  assert.deepEqual(f.restoreData(JSON.stringify(data)), data);
});
test('restore preserves legacy v3 and rejects corrupt new optional fields', () => {
  assert.deepEqual(f.restoreData(JSON.stringify(f.initialData())), f.initialData());
  for (const fields of [{ bodyweight: null }, { bodyweight: [{ date: 'bad', weight: 10, unit: 'kg' }] }, { reminder: { enabled: true, days: [], time: '18:00' } }, { reminder: null }]) assert.throws(() => f.restoreData(JSON.stringify({ ...f.initialData(), ...fields })));
  const entry = session('a', '2026-09-07');
  assert.throws(() => f.restoreData(JSON.stringify({ ...f.initialData(), history: [{ ...entry, notes: 123 }] })));
  assert.throws(() => f.restoreData(JSON.stringify({ ...f.initialData(), history: [{ ...entry, notes: 'x'.repeat(2001) }] })));
  const body = { date: '2026-09-07', weight: 80, unit: 'kg' };
  assert.throws(() => f.restoreData(JSON.stringify({ ...f.initialData(), bodyweight: [body, body] })));
});
