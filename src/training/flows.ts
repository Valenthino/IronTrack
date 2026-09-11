import { validBodyweight, validReminder, type Bodyweight, type Reminder } from './progress';
import { barWeight, presetProgram, validProgram, type Program, completeSession, createTrainingState, increment, workoutDefinition, type Lift, type TrainingState, type Unit } from './engine';

export const liftNames: Record<Lift, string> = { squat: 'Squat', bench_press: 'Bench press', barbell_row: 'Barbell row', overhead_press: 'Overhead press', deadlift: 'Deadlift' };
export const lifts = Object.keys(liftNames) as Lift[];
export type Profile = { experience: 'new' | 'returning' | 'experienced'; goal: 'strength' | 'size' | 'confidence'; schedule?: { daysPerWeek: 2 | 3 | 4; trainingDays: number[] } };
export type Draft = { notes?: string; id: string; restDeadline?: number | null; training: TrainingState; reps: Partial<Record<Lift, (number | null)[]>> };
export type Entry = { notes?: string; id: string; completedAt: string; training: TrainingState; reps: Draft['reps'] };
export type AppData = { version: 3; profile: Profile | null; training: TrainingState; draft: Draft | null; history: Entry[]; bodyweight?: Bodyweight[]; reminder?: Reminder };
export const initialData = (): AppData => ({ version: 3, profile: null, training: createTrainingState('lb'), draft: null, history: [] });
export function setupTraining(unit: Unit, values: Partial<Record<Lift, string>>, daysPerWeek = 3): TrainingState {
  const state = createTrainingState(unit);
  if (!Number.isInteger(daysPerWeek) || daysPerWeek < 1 || daysPerWeek > 7) throw new Error('Choose 1–7 days per week.');
  return { ...state, program: { ...state.program, daysPerWeek }, lifts: Object.fromEntries(lifts.map(lift => {
    const raw = values[lift]?.trim();
    const weight = raw ? Number(raw) : barWeight(unit);
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error(`Enter a finite ${liftNames[lift]} weight of 0 ${unit} or more.`);
    }
    return [lift, { weight, stalls: 0 }];
  })) as TrainingState['lifts'] };
}
export function startDraft(training: TrainingState, id: string): Draft {
  return { id, training, restDeadline: null, reps: Object.fromEntries(workoutDefinition(training.nextWorkout, training.program).map(({ lift, sets }) => [lift, Array(sets).fill(null)])) };
}
export function setReps(draft: Draft, lift: Lift, index: number, reps: number | null): Draft {
  const current = draft.reps[lift];
  if (!current || !Number.isInteger(index) || index < 0 || index >= current.length || (reps !== null && (!Number.isInteger(reps) || reps < 0 || reps > 5))) throw new Error('Invalid set');
  return { ...draft, reps: { ...draft.reps, [lift]: current.map((value, i) => i === index ? reps : value) } };
}
export function draftComplete(draft: Draft): boolean {
  return workoutDefinition(draft.training.nextWorkout, draft.training.program).every(({ lift, sets }) => draft.reps[lift]?.length === sets && draft.reps[lift]!.every(r => r !== null && Number.isInteger(r) && r >= 0 && r <= 5));
}
export function finishWorkout(data: AppData, completedAt: string): AppData {
  const draft = data.draft;
  if (!draft || !draftComplete(draft)) throw new Error('Log every working set before finishing.');
  if (data.history.some(entry => entry.id === draft.id)) throw new Error('This workout is already saved.');
  const training = completeSession(draft.training, workoutDefinition(draft.training.nextWorkout, draft.training.program).map(({ lift }) => ({ lift, sets: draft.reps[lift]!.map(reps => ({ reps: reps!, weight: draft.training.lifts[lift].weight })) })));
  return { ...data, training, draft: null, history: [{ ...draft, completedAt }, ...data.history] };
}
/** Convert current targets to nearest loadable weight; historical sessions keep their original unit. */
export function changeUnit(data: AppData, unit: Unit): AppData {
  if (data.training.unit === unit) return data;
  if (data.draft) throw new Error('Finish your active workout before changing units.');
  const ratio = unit === 'lb' ? 2.2046226218 : 1 / 2.2046226218;
  const step = increment(unit, data.training.microloading);
  return { ...data, training: { ...data.training, unit, customBarWeight: data.training.customBarWeight === null ? null : Number((data.training.customBarWeight * ratio).toFixed(8)), lifts: Object.fromEntries(lifts.map(lift => [lift, { ...data.training.lifts[lift], weight: Math.round(data.training.lifts[lift].weight * ratio / step) * step }])) as TrainingState['lifts'] } };
}
export function changeEquipment(data: AppData, microloading: boolean, customBarWeight: number | null): AppData {
  if (data.draft) throw new Error('Finish your active workout before changing equipment.');
  if (typeof microloading !== 'boolean' || (customBarWeight !== null && (!Number.isFinite(customBarWeight) || customBarWeight < 0))) throw new Error('Enter a finite bar weight of 0 or more.');
  return { ...data, training: { ...data.training, microloading, customBarWeight } };
}
export function remainingSeconds(deadline: number | null, now: number): number {
  return deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
}
export function validEmail(value: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }

/** Validate local storage before exposing it to the engine or screens. */
export function restoreData(raw: string): AppData {
  const parsed = JSON.parse(raw);
  if (parsed?.version === 1) {
    const migrateTraining = (state: TrainingState) => state && ({ ...state, microloading: false, customBarWeight: null });
    parsed.training = migrateTraining(parsed.training);
    if (parsed.draft) parsed.draft.training = migrateTraining(parsed.draft.training);
    if (Array.isArray(parsed.history)) parsed.history = parsed.history.map((entry: Entry) => entry && ({ ...entry, training: migrateTraining(entry.training) }));
    parsed.version = 2;
  }
  if (parsed?.version === 2) {
    const migrateTraining = (state: TrainingState) => state && ({ ...state, program: {
      ...presetProgram('classic'), daysPerWeek: parsed.profile?.schedule?.daysPerWeek ?? 3,
    } });
    parsed.training = migrateTraining(parsed.training);
    if (parsed.draft) parsed.draft.training = migrateTraining(parsed.draft.training);
    if (Array.isArray(parsed.history)) parsed.history = parsed.history.map((entry: Entry) => entry && ({ ...entry, training: migrateTraining(entry.training) }));
    parsed.version = 3;
  }
  const value = parsed as AppData;
  const validTraining = (state: TrainingState) => state && (state.unit === 'kg' || state.unit === 'lb') && validProgram(state.program) && state.program.days.some(day => day.id === state.nextWorkout) && typeof state.microloading === 'boolean' && (state.customBarWeight === null || (Number.isFinite(state.customBarWeight) && state.customBarWeight >= 0)) && lifts.every(lift => {
    const item = state.lifts?.[lift];
    return item && Number.isFinite(item.weight) && item.weight >= 0 && Number.isInteger(item.stalls) && item.stalls >= 0 && item.stalls <= 2;
  });
  const validDraft = (draft: Draft) => draft && typeof draft.id === 'string' && (draft.notes === undefined || (typeof draft.notes === 'string' && draft.notes.length <= 2000)) && (draft.restDeadline == null || (Number.isFinite(draft.restDeadline) && draft.restDeadline >= 0)) && validTraining(draft.training) && workoutDefinition(draft.training.nextWorkout, draft.training.program).every(({ lift, sets }) => Array.isArray(draft.reps?.[lift]) && draft.reps[lift]!.length === sets && draft.reps[lift]!.every(r => r === null || (Number.isInteger(r) && r >= 0 && r <= 5)));
  if (value?.version !== 3 || !validTraining(value.training) || (value.profile !== null && (!value.profile || !['new', 'returning', 'experienced'].includes(value.profile.experience) || !['strength', 'size', 'confidence'].includes(value.profile.goal) || (value.profile.schedule !== undefined && !validSchedule(value.profile.schedule)))) || (value.draft !== null && !validDraft(value.draft)) || !Array.isArray(value.history) || !value.history.every(entry => validDraft(entry) && draftComplete(entry) && typeof entry.completedAt === 'string' && Number.isFinite(Date.parse(entry.completedAt)))) throw new Error('Saved training data could not be read.');
  if (new Set(value.history.map(entry => entry.id)).size !== value.history.length || (value.draft && (value.history.some(entry => entry.id === value.draft!.id) || JSON.stringify(value.draft.training) !== JSON.stringify(value.training)))) throw new Error('Saved workout state is inconsistent.');
  if ((value.bodyweight !== undefined && (!Array.isArray(value.bodyweight) || !value.bodyweight.every(validBodyweight) || new Set(value.bodyweight.map(item => item.date)).size !== value.bodyweight.length)) || (value.reminder !== undefined && !validReminder(value.reminder))) throw new Error('Saved progress settings could not be read.');
  return value;
}

/** Monday = 0; optional for compatibility with existing local profiles. */
export function validSchedule(schedule: NonNullable<Profile['schedule']>): boolean {
  return !!schedule && [2, 3, 4].includes(schedule.daysPerWeek) && Array.isArray(schedule.trainingDays)
    && schedule.trainingDays.length === schedule.daysPerWeek && new Set(schedule.trainingDays).size === schedule.daysPerWeek
    && schedule.trainingDays.every(day => Number.isInteger(day) && day >= 0 && day <= 6);
}
export const schedulePatterns: Record<2 | 3 | 4, number[][]> = {
  2: [[0, 3], [1, 4], [2, 5]],
  3: [[0, 2, 4], [1, 3, 5], [0, 3, 5]],
  4: [[0, 1, 3, 5], [1, 2, 4, 6], [0, 2, 4, 6]],
};
export function startingWeightHint(experience: Profile['experience'], goal: Profile['goal'], lift: Lift): string {
  const experienceHint = { new: 'Start with the empty bar to learn the movement.', returning: 'Start below your previous working weight and rebuild gradually.', experienced: 'Choose a familiar load you can repeat with clean reps.' }[experience];
  const goalHint = { strength: 'Leave room to add weight as you progress.', size: 'Prioritize a controlled range of motion on every rep.', confidence: 'Choose a load that feels manageable and repeatable.' }[goal];
  const liftHint = { squat: 'Keep your whole foot planted.', bench_press: 'Keep the bar path steady.', barbell_row: 'Keep your torso stable.', overhead_press: 'Avoid leaning back to finish.', deadlift: 'Reset your position between reps.' }[lift];
  return `${experienceHint} ${goalHint} ${liftHint}`;
}

/** Save a validated plan atomically. Stable day IDs retain the current rotation on edits. */
export function changeProgram(data: AppData, program: Program, restart = false): AppData {
  if (data.draft) throw new Error('Finish your active workout before changing your program.');
  if (!validProgram(program)) throw new Error('Name your program and days, and include at least one lift per day. Choose 1–7 days per week.');
  const copy: Program = { ...program, name: program.name.trim(), days: program.days.map(day => ({ ...day, name: day.name.trim(), lifts: [...day.lifts] })) };
  const next = !restart && copy.days.some(day => day.id === data.training.nextWorkout) ? data.training.nextWorkout : copy.days[0].id;
  // The onboarding weekday pattern is no longer applicable when frequency changes.
  const profile = data.profile?.schedule && data.profile.schedule.daysPerWeek !== copy.daysPerWeek
    ? { experience: data.profile.experience, goal: data.profile.goal } : data.profile;
  return { ...data, profile, training: { ...data.training, program: copy, nextWorkout: next } };
}
