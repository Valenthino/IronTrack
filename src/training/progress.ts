import type { AppData, Entry } from './flows';
import { workoutDefinition, type Lift, type Unit } from './engine';
export type Bodyweight = { date: string; weight: number; unit: Unit };
export type Reminder = { enabled: boolean; days: number[]; time: string; dismissed?: string };
export const defaultReminder = (): Reminder => ({ enabled: false, days: [0, 2, 4], time: '18:00' });
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && dateKey(date) === value;
}
export function validBodyweight(value: Bodyweight): boolean {
  return !!value && typeof value.date === 'string' && validDate(value.date) && Number.isFinite(value.weight) && value.weight > 0 && ['kg', 'lb'].includes(value.unit);
}
export function validReminder(value: Reminder): boolean {
  return !!value && typeof value.enabled === 'boolean' && Array.isArray(value.days) && value.days.length > 0 && new Set(value.days).size === value.days.length && value.days.every(day => Number.isInteger(day) && day >= 0 && day < 7) && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.time) && (value.dismissed === undefined || validDate(value.dismissed));
}
export function convertWeight(weight: number, from: Unit, to: Unit): number { return from === to ? weight : weight * (to === 'lb' ? 2.2046226218 : 1 / 2.2046226218); }
export function liftProgress(history: Entry[], lift: Lift, unit: Unit) {
  return [...history].sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt) || a.id.localeCompare(b.id))
    .filter(entry => workoutDefinition(entry.training.nextWorkout, entry.training.program).some(item => item.lift === lift))
    .map(entry => ({ id: entry.id, date: dateKey(new Date(entry.completedAt)), weight: convertWeight(entry.training.lifts[lift].weight, entry.training.unit, unit), achieved: entry.reps[lift]!.some(reps => reps !== null && reps > 0) }));
}
/** PR = heaviest working weight with at least one completed rep, not an estimated 1RM. */
export function personalRecord(history: Entry[], lift: Lift, unit: Unit): number | null {
  const achieved = liftProgress(history, lift, unit).filter(point => point.achieved);
  return achieved.length ? Math.max(...achieved.map(point => point.weight)) : null;
}
export function liftOutcome(entry: Entry, lift: Lift): string {
  if (entry.reps[lift]!.every(reps => reps === 5)) return 'Completed';
  const stalls = entry.training.lifts[lift].stalls + 1;
  return stalls === 3 ? 'Deload triggered · third stall; next target deload applied by the training engine.' : `Stall ${stalls}/3 · repeat this weight next time.`;
}
export function saveNote(data: AppData, id: string, notes: string): AppData {
  if (notes.length > 2000) throw new Error('Keep notes under 2,000 characters.');
  if (data.draft?.id === id) return { ...data, draft: { ...data.draft, notes } };
  if (!data.history.some(entry => entry.id === id)) throw new Error('Session not found.');
  return { ...data, history: data.history.map(entry => entry.id === id ? { ...entry, notes } : entry) };
}
export function logBodyweight(data: AppData, entry: Bodyweight): AppData {
  if (!validBodyweight(entry)) throw new Error('Enter a valid date and bodyweight greater than zero.');
  return { ...data, bodyweight: [...(data.bodyweight ?? []).filter(item => item.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date)) };
}
export function saveReminder(data: AppData, reminder: Reminder): AppData {
  if (!validReminder(reminder)) throw new Error('Choose at least one day and a time in HH:MM format.');
  return { ...data, reminder: { enabled: reminder.enabled, days: [...reminder.days], time: reminder.time } };
}
export function reminderDue(data: AppData, now: Date): boolean {
  const reminder = data.reminder;
  const today = dateKey(now);
  return !!reminder?.enabled && reminder.days.includes((now.getDay() + 6) % 7) && `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` >= reminder.time && reminder.dismissed !== today && !data.draft && !data.history.some(entry => dateKey(new Date(entry.completedAt)) === today);
}
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1, 12);
  const cells: (string | null)[] = Array((first.getDay() + 6) % 7).fill(null);
  const count = new Date(year, month + 1, 0, 12).getDate();
  for (let day = 1; day <= count; day++) cells.push(dateKey(new Date(year, month, day, 12)));
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}
/** Consecutive Monday-based weeks meeting the current weekly target; current week has grace. */
export function trainingStreak(history: Entry[], target: number, now: Date): number {
  if (!Number.isInteger(target) || target < 1 || target > 7) throw new Error('Invalid weekly target');
  const monday = (date: Date) => { const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12); result.setDate(result.getDate() - (result.getDay() + 6) % 7); return result; };
  const weeks = new Map<string, Set<string>>();
  for (const entry of history) {
    const date = new Date(entry.completedAt);
    if (date > now) continue;
    const key = dateKey(monday(date));
    const days = weeks.get(key) ?? new Set<string>(); days.add(dateKey(date)); weeks.set(key, days);
  }
  const cursor = monday(now);
  let streak = (weeks.get(dateKey(cursor))?.size ?? 0) >= target ? 1 : 0;
  cursor.setDate(cursor.getDate() - 7);
  while ((weeks.get(dateKey(cursor))?.size ?? 0) >= target) { streak++; cursor.setDate(cursor.getDate() - 7); }
  return streak;
}
