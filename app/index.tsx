import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { AppState, Pressable, Text, View } from 'react-native';
import { useTraining } from '../src/state/store';
import { draftComplete, finishWorkout, liftNames, remainingSeconds, setReps, startDraft } from '../src/training/flows';
import { restSeconds, warmupSets, workoutDefinition, type Lift, type Workout } from '../src/training/engine';
import { Button, Message, Screen, s } from '../src/ui/common';

export default function Today() {
  const router = useRouter();
  const { data, ready, saving, error: storageError, update } = useTraining();
  const [preview, setPreview] = useState<Workout | null>(null);
  const [selected, setSelected] = useState<{ lift: Lift; index: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const interval = setInterval(refresh, 500);
    const subscription = AppState.addEventListener('change', refresh);
    return () => { clearInterval(interval); subscription.remove(); };
  }, []);
  const draft = data.draft;
  const training = draft?.training || data.training;
  const workout = draft ? training.nextWorkout : preview || training.nextWorkout;
  const deadline = draft?.restDeadline ?? null;
  const seconds = remainingSeconds(deadline, now);
  async function setRest(duration: number | null) {
    setNow(Date.now());
    await act(current => current.draft ? { ...current, draft: { ...current.draft, restDeadline: duration === null ? null : Date.now() + duration * 1000 } } : current);
  }
  async function act(change: Parameters<typeof update>[0]) {
    setError(''); try { await update(change); return true; } catch (err) { setError(err instanceof Error ? err.message : 'Could not save. Please retry.'); return false; }
  }
  async function log(reps: number | null) {
    if (!selected) return;
    const success = await act(current => {
      if (!current.draft) throw new Error('Start a workout first.');
      return { ...current, draft: { ...setReps(current.draft, selected.lift, selected.index, reps), restDeadline: reps === null ? current.draft.restDeadline : Date.now() + restSeconds(reps < 5) * 1000 } };
    });
    if (success) { setSelected(null); setNow(Date.now()); }
  }
  if (!ready) return <Screen title="Today’s workout"><Message>{storageError || 'Loading training…'}</Message></Screen>;
  if (!data.profile) return <Screen title="One lift at a time." eyebrow="SIMPLE WORKOUTS. STEADY PROGRESS."><Text style={s.text}>Three lifts. A clear plan. A little stronger each session.</Text><View style={s.card}><Text style={s.heading}>Your first 5 × 5 starts here.</Text><Text style={s.muted}>Set your starting weights, log each set, and let your plan progress with you.</Text><Button title="Set up my training" onPress={() => router.push('/onboarding')} /><Button title="Sign in with email" secondary onPress={() => router.push('/auth')} /></View><Text style={s.muted}>No account needed to train. Your workouts are saved on this device.</Text></Screen>;
  return <Screen title={draft ? `Let’s lift. Workout ${workout}.` : 'Today’s workout'} eyebrow={`${data.profile.goal.toUpperCase()} · ${draft ? 'IN PROGRESS' : `NEXT UP: ${training.nextWorkout}`}`}>
    {saved && <Message>Workout saved. Your next targets are ready.</Message>}
    {!draft && <View style={s.row}>{(['A', 'B'] as const).map(value => <Button key={value} title={`Workout ${value}${workout === value ? ' ✓' : ''}`} secondary={workout !== value} onPress={() => setPreview(value)} />)}</View>}
    {!draft && workout !== training.nextWorkout && <Text style={s.muted}>Preview only. Your next scheduled workout is {training.nextWorkout}.</Text>}
    {draft && <View style={s.card}><View style={s.row}><Text style={s.heading}>Rest timer</Text><Text accessibilityLabel={`${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds remaining`} style={s.heading}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</Text></View><Text accessibilityLiveRegion="polite" style={s.muted}>{deadline === null ? 'Starts when you log a set.' : seconds === 0 ? 'Rest complete. Ready for your next set.' : 'Take your time. Make the next set count.'}</Text><View style={s.row}><Button title="2 minutes" secondary disabled={saving} onPress={() => setRest(restSeconds())} /><Button title="3 minutes" secondary disabled={saving} onPress={() => setRest(restSeconds(true))} /><Button title="Skip rest" secondary disabled={saving} onPress={() => setRest(null)} /></View></View>}
    {workoutDefinition(workout).map(({ lift, sets, reps }, index) => {
      const weight = training.lifts[lift].weight;
      const warmups = warmupSets(weight, training.unit);
      return <View key={lift} style={s.card}><Text style={s.eyebrow}>0{index + 1} / {sets} × {reps}</Text><View style={s.row}><Text accessibilityRole="header" style={s.heading}>{liftNames[lift]}</Text><Text style={s.heading}>{weight} {training.unit}</Text></View>
        <Text style={s.muted}>Warm-up: {warmups.length ? warmups.map(set => `${set.weight} ${training.unit} × ${set.reps}`).join(' · ') : 'Empty-bar working weight; no separate warm-up sets.'}</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{Array.from({ length: sets }, (_, i) => {
          const logged = draft?.reps[lift]?.[i];
          return <Pressable key={i} disabled={!draft || saving} accessibilityRole="button" accessibilityLabel={`${liftNames[lift]}, set ${i + 1}, ${logged == null ? 'not logged' : `${logged} of 5 reps`}. Edit reps.`} accessibilityState={{ disabled: !draft || saving }} onPress={() => setSelected({ lift, index: i })} style={{ minWidth: 48, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: selected?.lift === lift && selected.index === i ? 'white' : '#666C77', backgroundColor: logged == null ? '#101113' : logged === 5 ? '#C91D2C' : '#FAFAFA' }}><Text style={{ color: logged != null && logged < 5 ? '#101113' : 'white', fontWeight: '800', fontSize: 20 }}>{logged == null ? '—' : logged}</Text><Text style={{ color: logged != null && logged < 5 ? '#303237' : '#AAAEB7', fontSize: 10 }}>SET {i + 1}</Text></Pressable>;
        })}</View>
        {selected?.lift === lift && draft && <View style={{ gap: 12 }}><Text style={s.text}>{liftNames[lift]} · set {selected.index + 1}: reps completed</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[0, 1, 2, 3, 4, 5].map(count => <Button key={count} title={`${count} reps`} disabled={saving} secondary={count !== 5} onPress={() => log(count)} />)}</View><Text style={s.muted}>0 means attempted with no completed reps. Fewer than 5 starts a 3-minute rest.</Text><Button title="Clear this set" secondary disabled={saving} onPress={() => log(null)} /><Button title="Close set editor" secondary onPress={() => setSelected(null)} /></View>}
      </View>;
    })}
    {!!(error || storageError) && <Message>{error || storageError}</Message>}
    {!draft ? <Button title={`Start workout ${training.nextWorkout}`} disabled={saving} onPress={async () => { const success = await act(current => ({ ...current, draft: startDraft(current.training, `${Date.now()}-${Math.random().toString(36).slice(2)}`) })); if (success) { setSaved(false); setPreview(null); } }} /> : <><Text style={s.muted}>Tap each set box and choose your reps. Log every working set to finish; missed reps keep the lift at its current weight, with a deload after three stalls.</Text><Button title={saving ? 'Saving…' : 'Finish & save workout'} disabled={saving || !draftComplete(draft)} onPress={async () => { if (await act(current => finishWorkout(current, new Date().toISOString()))) { setSaved(true); setPreview(null); setSelected(null); } }} /><Text style={s.muted}>Your sets are saved as you go. You can leave and resume this workout.</Text></>}
  </Screen>;
}
