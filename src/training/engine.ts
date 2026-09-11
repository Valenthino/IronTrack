/** Pure training rules. All weights are total bar + plates in the selected unit. */
export type Unit = 'kg' | 'lb';
export type Workout = string;
export type ProgramDay = Readonly<{ id: string; name: string; lifts: readonly Lift[] }>;
export type Program = Readonly<{ name: string; daysPerWeek: number; days: readonly ProgramDay[] }>;
export type Preset = 'classic' | 'ppl' | 'upper_lower';
export type Lift = 'squat' | 'bench_press' | 'barbell_row' | 'overhead_press' | 'deadlift';
export type LiftState = Readonly<{ weight: number; stalls: number }>;
export type TrainingState = Readonly<{
  program: Program;
  unit: Unit;
  nextWorkout: Workout;
  microloading: boolean;
  customBarWeight: number | null;
  lifts: Readonly<Record<Lift, LiftState>>;
}>;
export type PerformedSet = Readonly<{ reps: number; weight: number; warmup?: boolean }>;
export type ExerciseResult = Readonly<{ lift: Lift; sets: readonly PerformedSet[] }>;

function nonnegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and nonnegative`);
}
function integer(value: number, name: string): void {
  nonnegative(value, name);
  if (!Number.isSafeInteger(value)) throw new RangeError(`${name} must be an integer`);
}
function validateUnit(unit: Unit): void {
  if (unit !== 'kg' && unit !== 'lb') throw new RangeError('Unknown weight unit');
}
export function increment(unit: Unit, microloading = false): number {
  validateUnit(unit);
  return (unit === 'kg' ? 2.5 : 5) / (microloading ? 2 : 1);
}
export function barWeight(unit: Unit): number {
  validateUnit(unit);
  return unit === 'kg' ? 20 : 45;
}
export function presetProgram(preset: Preset): Program {
  const day = (id: string, name: string, lifts: Lift[]): ProgramDay => ({ id, name, lifts });
  switch (preset) {
    case 'classic': return { name: 'Classic A/B', daysPerWeek: 3, days: [day('A', 'A', ['squat', 'bench_press', 'barbell_row']), day('B', 'B', ['squat', 'overhead_press', 'deadlift'])] };
    case 'ppl': return { name: 'PPL', daysPerWeek: 3, days: [day('push', 'Push', ['bench_press', 'overhead_press']), day('pull', 'Pull', ['barbell_row', 'deadlift']), day('legs', 'Legs', ['squat'])] };
    case 'upper_lower': return { name: 'Upper/Lower', daysPerWeek: 4, days: [day('upper', 'Upper', ['bench_press', 'barbell_row', 'overhead_press']), day('lower', 'Lower', ['squat', 'deadlift'])] };
    default: throw new RangeError('Unknown preset');
  }
}
export function validProgram(program: Program): boolean {
  const core = ['squat', 'bench_press', 'barbell_row', 'overhead_press', 'deadlift'];
  return !!program && typeof program.name === 'string' && !!program.name.trim()
    && Number.isInteger(program.daysPerWeek) && program.daysPerWeek >= 1 && program.daysPerWeek <= 7
    && Array.isArray(program.days) && program.days.length > 0
    && new Set(program.days.map(day => day?.id)).size === program.days.length
    && program.days.every(day => !!day && typeof day.id === 'string' && !!day.id.trim()
      && typeof day.name === 'string' && !!day.name.trim() && Array.isArray(day.lifts)
      && day.lifts.length > 0 && new Set(day.lifts).size === day.lifts.length && day.lifts.every((lift: unknown) => typeof lift === 'string' && core.includes(lift)));
}
export function workoutDefinition(workout: Workout, program: Program = presetProgram('classic')) {
  if (!validProgram(program)) throw new RangeError('Invalid program');
  const day = program.days.find(day => day.id === workout);
  if (!day) throw new RangeError('Unknown workout');
  return day.lifts.map(lift => ({ lift, sets: lift === 'deadlift' ? 1 : 5, reps: 5 }));
}
export function nextWorkout(workout: Workout, program: Program): Workout {
  workoutDefinition(workout, program);
  return program.days[(program.days.findIndex(day => day.id === workout) + 1) % program.days.length].id;
}
export function workoutName(state: TrainingState, id = state.nextWorkout): string {
  return state.program.days.find(day => day.id === id)?.name ?? id;
}
export function createTrainingState(unit: Unit): TrainingState {
  const weight = barWeight(unit);
  return { program: presetProgram('classic'), unit, nextWorkout: 'A', microloading: false, customBarWeight: null, lifts: {
    squat: { weight, stalls: 0 }, bench_press: { weight, stalls: 0 },
    barbell_row: { weight, stalls: 0 }, overhead_press: { weight, stalls: 0 },
    deadlift: { weight, stalls: 0 },
  } };
}

/** Call once when a session is finalized. Abandoned sessions should not be submitted.
 * All prescribed working sets must be logged (zero reps is a failed attempt).
 * Warm-ups never count toward progression. Squat state is shared across all program days.
 */
export function completeSession(state: TrainingState, results: readonly ExerciseResult[]): TrainingState {
  const step = increment(state.unit, state.microloading);
  const definition = workoutDefinition(state.nextWorkout, state.program);
  if (results.length !== definition.length || new Set(results.map(r => r.lift)).size !== results.length) {
    throw new RangeError('Provide each prescribed exercise exactly once');
  }
  const lifts = { ...state.lifts };
  for (const target of definition) {
    const result = results.find(r => r.lift === target.lift);
    if (!result) throw new RangeError(`Missing ${target.lift}`);
    const previous = state.lifts[target.lift];
    nonnegative(previous.weight, 'Weight');
    integer(previous.stalls, 'Stalls');
    if (previous.stalls > 2) throw new RangeError('Stalls must be between 0 and 2');
    for (const set of result.sets) {
      integer(set.reps, 'Reps');
      nonnegative(set.weight, 'Set weight');
    }
    const working = result.sets.filter(set => !set.warmup);
    if (working.length !== target.sets) throw new RangeError(`Expected ${target.sets} working sets for ${target.lift}`);
    const success = working.every(set => set.reps >= target.reps && set.weight >= previous.weight);
    const stalls = success ? 0 : previous.stalls + 1;
    // Snap deloads to the selected increment without imposing a bar-weight floor.
    const deload = Math.min(previous.weight, Math.round(previous.weight * 0.9 / step) * step);
    lifts[target.lift] = {
      weight: success ? previous.weight + step : stalls === 3 ? deload : previous.weight,
      stalls: stalls === 3 ? 0 : stalls,
    };
  }
  return { ...state, nextWorkout: nextWorkout(state.nextWorkout, state.program), lifts };
}

/** Two empty-bar sets, then 40% ×5, 60% ×3, 80% ×2; omit duplicate or working loads. */
export function warmupSets(weight: number, unit: Unit, bar = barWeight(unit), microloading = false) {
  nonnegative(weight, 'Working weight');
  nonnegative(bar, 'Bar weight');
  const step = increment(unit, microloading);
  if (weight <= bar) return [];
  const sets = [{ weight: bar, reps: 5 }, { weight: bar, reps: 5 }];
  for (const [ratio, reps] of [[0.4, 5], [0.6, 3], [0.8, 2]]) {
    const load = bar + Math.floor((weight * ratio - bar) / step) * step;
    if (load > sets[sets.length - 1].weight && load < weight) sets.push({ weight: load, reps });
  }
  return sets;
}

/** Seconds: two minutes normally, three after a difficult or failed set. */
export function restSeconds(difficult = false): number {
  return difficult ? 180 : 120;
}

/** Standard denominations, unlimited matched pairs; returned counts are PER SIDE.
 * Round down to a loadable weight and report the remainder, never silently overload. Below-bar targets return the bare bar and a negative remainder.
 */
export function calculatePlates(weight: number, unit: Unit, bar = barWeight(unit), microloading = false) {
  validateUnit(unit);
  nonnegative(weight, 'Target weight');
  nonnegative(bar, 'Bar weight');
  if (weight < bar) return { plates: [], loadedWeight: bar, remainder: weight - bar };
  const denominations = unit === 'kg' ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5];
  if (microloading) denominations.push(unit === 'kg' ? 0.625 : 1.25);
  // Integer eighth-units avoid floating point subtraction during plate selection.
  let remaining = Math.floor((weight - bar) * 4 + 1e-9);
  const plates: { weight: number; count: number }[] = [];
  for (const plate of denominations) {
    const count = Math.floor(remaining / (plate * 8));
    if (count) plates.push({ weight: plate, count });
    remaining -= count * plate * 8;
  }
  const loadedWeight = bar + 2 * plates.reduce((sum, p) => sum + p.weight * p.count, 0);
  return { plates, loadedWeight, remainder: Number((weight - loadedWeight).toFixed(8)) };
}
