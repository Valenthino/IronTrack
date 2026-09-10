import { barWeight, completeSession, createTrainingState, increment, workoutDefinition, type Lift, type TrainingState, type Unit } from './engine';

export const liftNames: Record<Lift, string> = { squat: 'Squat', bench_press: 'Bench press', barbell_row: 'Barbell row', overhead_press: 'Overhead press', deadlift: 'Deadlift' };
export const lifts = Object.keys(liftNames) as Lift[];
export type Profile = { experience: 'new' | 'returning' | 'experienced'; goal: 'strength' | 'size' | 'confidence' };
export type Draft = { id: string; restDeadline?: number | null; training: TrainingState; reps: Partial<Record<Lift, (number | null)[]>> };
export type Entry = { id: string; completedAt: string; training: TrainingState; reps: Draft['reps'] };
export type AppData = { version: 1; profile: Profile | null; training: TrainingState; draft: Draft | null; history: Entry[] };
export const initialData = (): AppData => ({ version: 1, profile: null, training: createTrainingState('kg'), draft: null, history: [] });
export function setupTraining(unit: Unit, values: Partial<Record<Lift, string>>): TrainingState {
  const state = createTrainingState(unit);
  return { ...state, lifts: Object.fromEntries(lifts.map(lift => {
    const raw = values[lift]?.trim();
    const weight = raw ? Number(raw) : barWeight(unit);
    if (!Number.isFinite(weight) || weight < barWeight(unit) || Math.abs(weight / increment(unit) - Math.round(weight / increment(unit))) > 1e-8) {
      throw new Error(`Enter a ${liftNames[lift]} weight of at least ${barWeight(unit)} ${unit}, in ${increment(unit)} ${unit} steps.`);
    }
    return [lift, { weight, stalls: 0 }];
  })) as TrainingState['lifts'] };
}
export function startDraft(training: TrainingState, id: string): Draft {
  return { id, training, restDeadline: null, reps: Object.fromEntries(workoutDefinition(training.nextWorkout).map(({ lift, sets }) => [lift, Array(sets).fill(null)])) };
}
export function setReps(draft: Draft, lift: Lift, index: number, reps: number | null): Draft {
  const current = draft.reps[lift];
  if (!current || !Number.isInteger(index) || index < 0 || index >= current.length || (reps !== null && (!Number.isInteger(reps) || reps < 0 || reps > 5))) throw new Error('Invalid set');
  return { ...draft, reps: { ...draft.reps, [lift]: current.map((value, i) => i === index ? reps : value) } };
}
export function draftComplete(draft: Draft): boolean {
  return workoutDefinition(draft.training.nextWorkout).every(({ lift, sets }) => draft.reps[lift]?.length === sets && draft.reps[lift]!.every(r => r !== null && Number.isInteger(r) && r >= 0 && r <= 5));
}
export function finishWorkout(data: AppData, completedAt: string): AppData {
  const draft = data.draft;
  if (!draft || !draftComplete(draft)) throw new Error('Log every working set before finishing.');
  if (data.history.some(entry => entry.id === draft.id)) throw new Error('This workout is already saved.');
  const training = completeSession(draft.training, workoutDefinition(draft.training.nextWorkout).map(({ lift }) => ({ lift, sets: draft.reps[lift]!.map(reps => ({ reps: reps!, weight: draft.training.lifts[lift].weight })) })));
  return { ...data, training, draft: null, history: [{ ...draft, completedAt }, ...data.history] };
}
/** Convert current targets to nearest loadable weight; historical sessions keep their original unit. */
export function changeUnit(data: AppData, unit: Unit): AppData {
  if (data.training.unit === unit) return data;
  if (data.draft) throw new Error('Finish your active workout before changing units.');
  const ratio = unit === 'lb' ? 2.2046226218 : 1 / 2.2046226218;
  const step = increment(unit);
  return { ...data, training: { ...data.training, unit, lifts: Object.fromEntries(lifts.map(lift => [lift, { ...data.training.lifts[lift], weight: Math.max(barWeight(unit), Math.round(data.training.lifts[lift].weight * ratio / step) * step) }])) as TrainingState['lifts'] } };
}
export function remainingSeconds(deadline: number | null, now: number): number {
  return deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
}
export function validEmail(value: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }

/** Validate local storage before exposing it to the engine or screens. */
export function restoreData(raw: string): AppData {
  const value = JSON.parse(raw) as AppData;
  const validTraining = (state: TrainingState) => state && (state.unit === 'kg' || state.unit === 'lb') && (state.nextWorkout === 'A' || state.nextWorkout === 'B') && lifts.every(lift => {
    const item = state.lifts?.[lift];
    return item && Number.isFinite(item.weight) && item.weight >= barWeight(state.unit) && Number.isInteger(item.stalls) && item.stalls >= 0 && item.stalls <= 2;
  });
  const validDraft = (draft: Draft) => draft && typeof draft.id === 'string' && (draft.restDeadline == null || (Number.isFinite(draft.restDeadline) && draft.restDeadline >= 0)) && validTraining(draft.training) && workoutDefinition(draft.training.nextWorkout).every(({ lift, sets }) => Array.isArray(draft.reps?.[lift]) && draft.reps[lift]!.length === sets && draft.reps[lift]!.every(r => r === null || (Number.isInteger(r) && r >= 0 && r <= 5)));
  if (value?.version !== 1 || !validTraining(value.training) || (value.profile !== null && (!value.profile || !['new', 'returning', 'experienced'].includes(value.profile.experience) || !['strength', 'size', 'confidence'].includes(value.profile.goal))) || (value.draft !== null && !validDraft(value.draft)) || !Array.isArray(value.history) || !value.history.every(entry => validDraft(entry) && draftComplete(entry) && typeof entry.completedAt === 'string' && Number.isFinite(Date.parse(entry.completedAt)))) throw new Error('Saved training data could not be read.');
  if (new Set(value.history.map(entry => entry.id)).size !== value.history.length || (value.draft && (value.history.some(entry => entry.id === value.draft!.id) || JSON.stringify(value.draft.training) !== JSON.stringify(value.training)))) throw new Error('Saved workout state is inconsistent.');
  return value;
}
