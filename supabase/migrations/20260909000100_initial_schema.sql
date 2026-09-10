begin;

create type public.weight_unit as enum ('lb', 'kg');
create type public.experience_level as enum ('beginner', 'intermediate', 'advanced');
create type public.training_goal as enum ('strength', 'size', 'confidence');
create type public.workout_day as enum ('A', 'B');
create type public.lift as enum ('squat', 'bench_press', 'barbell_row', 'overhead_press', 'deadlift');

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  experience_level public.experience_level not null,
  goal public.training_goal not null,
  starting_weight_unit public.weight_unit not null default 'lb',
  squat_start numeric(8,3) not null default 45 check (squat_start between 0 and 99999.999),
  bench_press_start numeric(8,3) not null default 45 check (bench_press_start between 0 and 99999.999),
  barbell_row_start numeric(8,3) not null default 45 check (barbell_row_start between 0 and 99999.999),
  overhead_press_start numeric(8,3) not null default 45 check (overhead_press_start between 0 and 99999.999),
  deadlift_start numeric(8,3) not null default 45 check (deadlift_start between 0 and 99999.999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  units public.weight_unit not null default 'lb',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Immutable, non-personal reference data, shared with signed-in users.
create table public.workout_definitions (
  workout public.workout_day not null,
  exercise public.lift not null,
  position smallint not null check (position between 1 and 3),
  target_sets smallint not null check (target_sets > 0),
  target_reps smallint not null check (target_reps > 0),
  primary key (workout, exercise),
  unique (workout, position)
);
insert into public.workout_definitions values
  ('A', 'squat', 1, 5, 5),
  ('A', 'bench_press', 2, 5, 5),
  ('A', 'barbell_row', 3, 5, 5),
  ('B', 'squat', 1, 5, 5),
  ('B', 'overhead_press', 2, 5, 5),
  ('B', 'deadlift', 3, 1, 5);

create table public.workout_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workout public.workout_day not null,
  exercise public.lift not null,
  working_weight numeric(8,3) not null check (working_weight between 0 and 99999.999),
  weight_unit public.weight_unit not null default 'lb',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workout, exercise) references public.workout_definitions(workout, exercise),
  unique (user_id, workout, exercise)
);

-- Each row is one performed set; session_id groups a workout's sets.
-- No mutable plan FK: changing/deleting a plan must not destroy history.
create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id uuid not null,
  workout public.workout_day not null,
  exercise public.lift not null,
  set_number smallint not null check (set_number > 0),
  reps smallint not null check (reps >= 0),
  weight numeric(8,3) not null check (weight between 0 and 99999.999),
  weight_unit public.weight_unit not null default 'lb',
  is_warmup boolean not null default false,
  performed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workout, exercise) references public.workout_definitions(workout, exercise),
  unique (user_id, session_id, exercise, is_warmup, set_number)
);
create index workout_logs_user_history_idx on public.workout_logs (user_id, performed_at desc);
create index workout_logs_user_lift_idx on public.workout_logs (user_id, exercise, performed_at desc);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.created_at := old.created_at;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- Explicit grants exclude TRUNCATE, REFERENCES and TRIGGER. Both old and new
-- ownership are checked on UPDATE; an owner cannot transfer a row.
do $$
declare t text;
begin
  foreach t in array array['profiles', 'settings', 'workout_plan', 'workout_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy own_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy own_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy own_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy own_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end;
$$;
alter table public.workout_definitions enable row level security;
alter table public.workout_definitions force row level security;
revoke all on public.workout_definitions from public, anon, authenticated;
grant select on public.workout_definitions to authenticated;
create policy read_definitions on public.workout_definitions for select to authenticated using (true);

commit;
