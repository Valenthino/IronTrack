import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTraining } from '../src/state/store';
import { liftNames, lifts } from '../src/training/flows';
import { workoutDefinition, workoutName } from '../src/training/engine';
import { convertWeight, dateKey, liftOutcome, liftProgress, logBodyweight, monthGrid, personalRecord, trainingStreak } from '../src/training/progress';
import { Button, Field, Loading, Message, Screen, s } from '../src/ui/common';
import { ProgressChart } from '../src/ui/ProgressChart';
import { SessionNotes } from '../src/ui/SessionNotes';
import { theme } from '../src/theme';
export default function History() {
  const { data, ready, saving, error, update } = useTraining();
  const router = useRouter();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12));
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(dateKey(new Date()));
  const [feedback, setFeedback] = useState('');
  const [failed, setFailed] = useState(false);
  const unit = data.training.unit;
  const entries = data.history.filter(entry => !selected || dateKey(new Date(entry.completedAt)) === selected);
  const bodyweight = [...(data.bodyweight ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  return <Screen title="Your progress." eyebrow="ONE SESSION AT A TIME">
    {!ready ? (error ? <Message>{error}</Message> : <Loading>Loading training…</Loading>) : !data.profile ? <Button title="Set up my training" onPress={() => router.push('/onboarding')} /> : <>
      <View style={s.card}><Text style={s.heading}>{trainingStreak(data.history, data.training.program.daysPerWeek, new Date())} week streak</Text><Text style={s.muted}>Train on {data.training.program.daysPerWeek} distinct days each week. Rest days never break your streak. This week stays open until Sunday ends; changing your weekly target recalculates the streak.</Text></View>
      {lifts.map(lift => { const record = personalRecord(data.history, lift, unit); return <View key={lift} style={s.card}><Text style={s.heading}>{liftNames[lift]}</Text><Text style={s.text}>Next target · {data.training.lifts[lift].weight} {unit}</Text>{record !== null && <Text style={s.badge}>PR · {record.toFixed(1)} {unit}</Text>}<ProgressChart points={liftProgress(data.history, lift, unit)} unit={unit} /></View>; })}
      <Text style={s.muted}>Graphs show logged working weights in {unit}. PR is your all-time heaviest weight with at least one completed rep, including tied records; it is not an estimated one-rep max.</Text>
      <View style={s.card}><Text style={s.heading}>Bodyweight · optional</Text><ProgressChart points={bodyweight.map(item => ({ date: item.date, weight: convertWeight(item.weight, item.unit, unit) }))} unit={unit} />
        <Field label="Log date (YYYY-MM-DD)" value={date} onChangeText={setDate} /><Field label={`Bodyweight (${unit})`} value={weight} keyboardType="decimal-pad" onChangeText={setWeight} placeholder="Optional" />
        <Text style={s.muted}>One entry per day. Saving again replaces that day’s bodyweight.</Text>
        <Button title="Save bodyweight" disabled={saving} onPress={async () => { try { await update(current => logBodyweight(current, { date, weight: Number(weight), unit })); setFailed(false); setFeedback('Bodyweight saved.'); setWeight(''); } catch (err) { setFailed(true); setFeedback(err instanceof Error ? err.message : 'Could not save.'); } }} />
        {!!feedback && <Message tone={failed ? 'error' : 'success'}>{feedback}</Message>}
      </View>
      <View style={[s.card, { paddingHorizontal: 8 }]}><Text style={s.heading}>Training calendar</Text><View style={s.row}><Button title="Previous month" secondary onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))} /><Button title="Next month" secondary onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))} /></View><Text style={s.text}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text><Text style={s.muted}>● Workout · ○ Bodyweight. Tap a date to see its sessions. Swipe the grid on narrow screens.</Text>
        <ScrollView horizontal><View style={{ minWidth: 336, flex: 1 }}><View style={{ flexDirection: 'row' }}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => <Text key={i} style={[s.muted, { width: 48, textAlign: 'center' }]}>{day}</Text>)}</View>{monthGrid(month.getFullYear(), month.getMonth()).map((week, i) => <View key={i} style={{ flexDirection: 'row' }}>{week.map((day, j) => { const count = day ? data.history.filter(entry => dateKey(new Date(entry.completedAt)) === day).length : 0; const body = bodyweight.find(item => item.date === day); return day ? <Pressable key={day} accessibilityRole="button" accessibilityLabel={`${day}, ${count} workouts${body ? ', bodyweight logged' : ''}`} accessibilityState={{ selected: selected === day }} onPress={() => { setSelected(day); setExpanded(null); }} style={{ width: 48, minHeight: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: selected === day ? theme.colors.red : 'transparent' }}><Text style={s.text}>{Number(day.slice(-2))}</Text><Text style={s.muted}>{count ? '●' : ' '}{body ? ' ○' : ''}</Text></Pressable> : <View key={j} style={{ width: 48, height: 58 }} />; })}</View>)}</View></ScrollView>
      </View>
      <Text style={s.heading}>{selected ?? 'Workout history'} · {entries.length}</Text>
      {selected && <><Button title="Show all sessions" secondary onPress={() => setSelected(null)} />{bodyweight.filter(item => item.date === selected).map(item => <Text key={item.date} style={s.text}>Bodyweight · {item.weight} {item.unit}</Text>)}</>}
      {!entries.length && <View style={s.card}><Text style={s.text}>{selected ? 'No workouts on this day. Rest is part of progress.' : 'Your first session is waiting.'}</Text><Text style={s.muted}>Completed workouts appear here with weights, reps, and notes.</Text><Button title="Go to today" onPress={() => router.push('/')} /></View>}
      {entries.map(entry => <View key={entry.id} style={s.card}><Button title={`Workout ${workoutName(entry.training)} · ${new Date(entry.completedAt).toLocaleString()}`} secondary onPress={() => setExpanded(expanded === entry.id ? null : entry.id)} />
        <Text style={s.muted}>{entry.training.program.name}</Text>
        {workoutDefinition(entry.training.nextWorkout, entry.training.program).map(({ lift }) => { const pr = personalRecord(data.history, lift, entry.training.unit); return <View key={lift} style={{ gap: 4 }}><Text style={s.text}>{liftNames[lift]} · {entry.training.lifts[lift].weight} {entry.training.unit}</Text>{pr !== null && Math.abs(pr - entry.training.lifts[lift].weight) < 0.00001 && entry.reps[lift]!.some(reps => reps! > 0) && <Text style={s.badge}>All-time PR</Text>}<Text style={s.muted}>{entry.reps[lift]?.join(' / ')} reps</Text><Text style={s.muted}>{liftOutcome(entry, lift)}</Text></View>; })}
        {!!entry.notes && <Text style={s.text}>{entry.notes}</Text>}
        {expanded === entry.id && <SessionNotes key={entry.id} id={entry.id} initial={entry.notes} />}
      </View>)}
    </>}
  </Screen>;
}
