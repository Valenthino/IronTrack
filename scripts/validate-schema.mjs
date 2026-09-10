// Local-only PostgreSQL/WASM test. No connection strings or remote access.
// npm install --prefix /tmp/irontrack-sql-validation @electric-sql/pglite@0.3.14
// node scripts/validate-schema.mjs (uses the local installation above by default)
// node scripts/validate-schema.mjs /tmp/irontrack-sql-validation/node_modules/@electric-sql/pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const pglitePath = process.argv[2] ?? '/tmp/irontrack-sql-validation/node_modules/@electric-sql/pglite/dist/index.js';
const { PGlite } = await import(pathToFileURL(pglitePath).href);
const db = new PGlite();
let checks = 0;
const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const session = '33333333-3333-4333-8333-333333333333';
async function denied(sql, code) {
  await assert.rejects(db.exec(sql), error => error.code === code);
  checks++;
}
async function asUser(id) {
  await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false)`);
}
try {
  // Minimal Supabase Auth stand-in; all data lives in memory.
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('${a}'), ('${b}');
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20260909000100_initial_schema.sql', import.meta.url), 'utf8'));
  checks++;
  const inserts = {
    profiles: "experience_level, goal) values ('beginner', 'strength'",
    settings: "units) values ('lb'",
    workout_plan: "workout, exercise, working_weight) values ('A', 'squat', 45",
    workout_logs: `session_id, workout, exercise, set_number, reps, weight) values ('${session}', 'A', 'squat', 1, 5, 45`,
  };
  for (const id of [a, b]) {
    await asUser(id);
    for (const [table, insert] of Object.entries(inserts)) {
      await db.exec(`insert into public.${table} (${insert})`);
    }
  }
  await asUser(a);
  for (const [table, insert] of Object.entries(inserts)) {
    const rows = (await db.query(`select * from public.${table}`)).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].user_id, a);
    checks++;
    await denied(`insert into public.${table} (user_id, ${insert.replace('values (', `values ('${b}', `)})`, '42501');
    await denied(`update public.${table} set user_id = '${b}' where user_id = '${a}'`, '42501');
    assert.equal((await db.query(`update public.${table} set updated_at = now() where user_id = '${b}' returning *`)).rows.length, 0);
    assert.equal((await db.query(`delete from public.${table} where user_id = '${b}' returning *`)).rows.length, 0);
    checks += 2;
    const updated = (await db.query(`update public.${table} set updated_at = '2000-01-01', created_at = '2000-01-01' returning *`)).rows[0];
    assert.deepEqual(updated.created_at, rows[0].created_at);
    assert.ok(new Date(updated.updated_at) > new Date(rows[0].updated_at));
    checks++;
  }
  assert.deepEqual((await db.query("select target_sets, target_reps from public.workout_definitions where exercise = 'deadlift'")).rows, [{ target_sets: 1, target_reps: 5 }]);
  assert.equal((await db.query('select * from public.workout_definitions')).rows.length, 6);
  checks += 2;
  await denied("delete from public.workout_definitions", '42501');
  await denied("update public.settings set units = 'stone'", '22P02');
  await denied("update public.workout_logs set reps = -1", '23514');
  await denied("update public.workout_logs set weight = -1", '23514');
  await denied("update public.workout_logs set weight = 'NaN'", '23514');
  await denied("update public.workout_plan set exercise = 'deadlift'", '23503');
  await denied(`insert into public.workout_logs (${inserts.workout_logs})`, '23505');
  await db.exec(`insert into public.workout_logs (${inserts.workout_logs.replace('session_id,', 'is_warmup, session_id,').replace('values (', 'values (true, ')})`);
  checks++;
  await db.exec('reset role; set role anon');
  for (const table of [...Object.keys(inserts), 'workout_definitions']) {
    await denied(`select * from public.${table}`, '42501');
  }
  await asUser('');
  assert.equal((await db.query('select * from public.profiles')).rows.length, 0);
  checks++;
  await asUser(a);
  for (const table of Object.keys(inserts)) {
    assert.ok((await db.query(`delete from public.${table} returning *`)).rows.length > 0);
    checks++;
  }
  await db.exec(`reset role; delete from auth.users where id = '${b}'`);
  for (const table of Object.keys(inserts)) {
    assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0);
    checks++;
  }
  console.log(`PASS: ${checks} migration, RLS, constraint, timestamp and cascade checks (local PGlite).`);
} finally {
  await db.close();
}
