// Maintained alongside supabase/migrations. PostgreSQL numeric maps to number.
export type WeightUnit = 'lb' | 'kg';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type TrainingGoal = 'strength' | 'size' | 'confidence';
export type WorkoutDay = 'A' | 'B';
export type Lift = 'squat' | 'bench_press' | 'barbell_row' | 'overhead_press' | 'deadlift';

type Timestamps = { created_at: string; updated_at: string };
export type Profile = Timestamps & {
  user_id: string;
  experience_level: ExperienceLevel;
  goal: TrainingGoal;
  starting_weight_unit: WeightUnit;
  squat_start: number;
  bench_press_start: number;
  barbell_row_start: number;
  overhead_press_start: number;
  deadlift_start: number;
};
export type Settings = Timestamps & { user_id: string; units: WeightUnit };
export type WorkoutDefinition = {
  workout: WorkoutDay; exercise: Lift; position: number;
  target_sets: number; target_reps: number;
};
export type WorkoutPlan = Timestamps & {
  id: string; user_id: string; workout: WorkoutDay; exercise: Lift;
  working_weight: number; weight_unit: WeightUnit;
};
export type WorkoutLog = Timestamps & {
  id: string; user_id: string; session_id: string;
  workout: WorkoutDay; exercise: Lift; set_number: number;
  reps: number; weight: number; weight_unit: WeightUnit;
  is_warmup: boolean; performed_at: string;
};
type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};
type DefinitionRelationship = [{
  foreignKeyName: 'workout_plan_workout_exercise_fkey';
  columns: ['workout', 'exercise'];
  isOneToOne: false;
  referencedRelation: 'workout_definitions';
  referencedColumns: ['workout', 'exercise'];
}];
export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, 'experience_level' | 'goal'>;
      settings: Table<Settings>;
      workout_definitions: {
        Row: WorkoutDefinition; Insert: never; Update: never; Relationships: [];
      };
      workout_plan: Omit<Table<WorkoutPlan, 'workout' | 'exercise' | 'working_weight'>, 'Relationships'> & {
        Relationships: DefinitionRelationship;
      };
      workout_logs: Omit<Table<WorkoutLog, 'session_id' | 'workout' | 'exercise' | 'set_number' | 'reps' | 'weight'>, 'Relationships'> & {
        Relationships: [Omit<DefinitionRelationship[0], 'foreignKeyName'> & {
          foreignKeyName: 'workout_logs_workout_exercise_fkey';
        }];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      weight_unit: WeightUnit; experience_level: ExperienceLevel;
      training_goal: TrainingGoal; workout_day: WorkoutDay; lift: Lift;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

/** Defaults are nominal empty bars, not an exact unit conversion. */
export function startingWeights(units: WeightUnit) {
  const weight = units === 'kg' ? 20 : 45;
  return {
    starting_weight_unit: units,
    squat_start: weight, bench_press_start: weight, barbell_row_start: weight,
    overhead_press_start: weight, deadlift_start: weight,
  };
}
