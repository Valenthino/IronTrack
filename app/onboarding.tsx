import { useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTraining } from '../src/state/store';
import { liftNames, lifts, schedulePatterns, setupTraining, startingWeightHint, validSchedule, type Profile } from '../src/training/flows';
import { barWeight, type Lift, type Unit } from '../src/training/engine';
import { Button, Field, Loading, Message, s } from '../src/ui/common';
import { LiftIllustration } from '../src/ui/LiftIllustration';
import { theme } from '../src/theme';
import { ExerciseGuideModal } from '../src/ui/ExerciseGuideModal';

const experiences = [ ['new', 'New to lifting', 'Build a strong foundation, one rep at a time.'], ['returning', 'Getting back into it', 'Find your rhythm and rebuild your strength.'], ['experienced', 'Already lifting', 'Bring your experience. Make progress visible.'] ] as const;
const goals = [ ['strength', 'Get stronger', 'Build strength with steady, measurable progress.'], ['size', 'Build muscle', 'Show up consistently and make every rep count.'], ['confidence', 'Feel confident', 'Get comfortable with the bar and your routine.'] ] as const;
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const titles = ['Start where you are.', 'Make it yours.', 'Find your rhythm.', 'Meet your starting line.', 'Your plan. Ready to go.'];
const labels = ['Experience', 'Goal', 'Schedule', 'Weights', 'Review'];
function Choice({ title, detail, selected, onPress }: { title: string; detail?: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress} style={({ pressed }) => [styles.choice, selected && styles.selected, pressed && { opacity: 0.7 }]}>
    <View style={{ flex: 1, gap: 5 }}><Text style={styles.choiceTitle}>{title}</Text>{detail && <Text style={s.muted}>{detail}</Text>}</View><Text style={{ color: selected ? '#FF6672' : '#AAAEB7', fontSize: 22 }}>{selected ? '●' : '○'}</Text>
  </Pressable>;
}
export default function Onboarding() {
  const { data, ready, saving, error: storageError, update } = useTraining();
  const router = useRouter();
  const [guideLift, setGuideLift] = useState<Lift | null>(null);
  const [step, setStep] = useState(0);
  const [experience, setExperience] = useState<Profile['experience']>('new');
  const [goal, setGoal] = useState<Profile['goal']>('strength');
  const [selectedUnit, setUnit] = useState<Unit | null>(null);
  const unit = selectedUnit ?? data.training.unit;
  const [daysPerWeek, setDays] = useState<2 | 3 | 4>(3);
  const [trainingDays, setTrainingDays] = useState<number[]>([0, 2, 4]);
  // Keep each unit's explicit inputs when navigating back; never reinterpret a load.
  const [weights, setWeights] = useState<Record<Unit, Partial<Record<Lift, string>>>>({ lb: {}, kg: {} });
  const values = weights[unit];
  const [errors, setErrors] = useState<Partial<Record<Lift, string>>>({});
  const [error, setError] = useState('');
  const schedule = { daysPerWeek, trainingDays };
  function validateWeights() {
    const next: Partial<Record<Lift, string>> = {};
    lifts.forEach(lift => { try { setupTraining(unit, { [lift]: values[lift] }); } catch { next[lift] = `Enter a finite weight of 0 ${unit} or more.`; } });
    setErrors(next);
    return Object.keys(next).length === 0;
  }
  function advance() {
    setError('');
    if (step === 2 && !validSchedule(schedule)) { setError(`Choose exactly ${daysPerWeek} training days.`); return; }
    if (step === 3 && !validateWeights()) return;
    setStep(current => current + 1);
  }
  async function finish() {
    if (!validSchedule(schedule)) { setStep(2); setError(`Choose exactly ${daysPerWeek} training days.`); return; }
    if (!validateWeights()) { setStep(3); return; }
    try {
      const training = setupTraining(unit, values, daysPerWeek);
      await update(current => ({ ...current, profile: { experience, goal, schedule }, training }));
      router.replace('/');
    } catch { setError('Your plan could not be saved. Please try again.'); }
  }
  if (ready && data.profile) return <Redirect href="/" />;
  return <SafeAreaView style={s.safe}><ScrollView key={step} keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}><View style={s.container}>
    <View style={s.row}><Text style={s.brand}>IRON<Text style={{ color: theme.colors.red }}>TRACK</Text></Text><Text style={styles.pill}>YOUR FIRST CHAPTER</Text></View>
    {!ready ? (storageError ? <Message>{storageError}</Message> : <Loading>Loading training…</Loading>) : <>
      <View style={{ gap: 10 }} accessibilityRole="progressbar" accessibilityLabel={`Onboarding: ${labels[step]}`} accessibilityValue={{ min: 1, max: 5, now: step + 1 }}>
        <View style={s.row}><Text style={s.eyebrow}>{labels[step].toUpperCase()}</Text><Text style={s.muted}>{step + 1} / 5</Text></View>
        <View style={{ flexDirection: 'row', gap: 6 }}>{labels.map((label, i) => <View key={label} style={{ flex: 1, height: 4, borderRadius: 4, backgroundColor: i <= step ? theme.colors.red : theme.colors.border }} />)}</View>
      </View>
      <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={s.title}>{titles[step]}</Text>
      {step === 0 && <><Text style={s.muted}>How familiar are you with barbell training?</Text>{experiences.map(([key, title, detail]) => <Choice key={key} title={title} detail={detail} selected={experience === key} onPress={() => setExperience(key)} />)}</>}
      {step === 1 && <><Text style={s.muted}>Pick what brings you here. Every goal follows the same focused A/B strength program.</Text>{goals.map(([key, title, detail]) => <Choice key={key} title={title} detail={detail} selected={goal === key} onPress={() => setGoal(key)} />)}</>}
      {step === 2 && <>
        <View style={s.card}><Text style={s.heading}>Your units</Text><View style={styles.columns}>{(['lb', 'kg'] as const).map(value => <View key={value} style={{ flex: 1 }}><Choice title={value} selected={unit === value} onPress={() => { setUnit(value); setErrors({}); }} /></View>)}</View><Text style={s.muted}>Weights are entered separately for each unit.</Text></View>
        <View style={s.card}><Text style={s.heading}>Days per week</Text><View style={styles.columns}>{([2, 3, 4] as const).map(days => <View key={days} style={{ flex: 1 }}><Choice title={String(days)} selected={daysPerWeek === days} onPress={() => { setDays(days); setTrainingDays(schedulePatterns[days][0]); setError(''); }} /></View>)}</View></View>
        <Text style={s.heading}>Make room for recovery</Text><Text style={s.muted}>Choose a weekly pattern. Unlisted days are rest days. This saves your preference; workouts still alternate A/B when you train.</Text>
        {schedulePatterns[daysPerWeek].map(pattern => <Choice key={pattern.join()} title={pattern.map(day => weekdays[day]).join(' · ')} detail={`Rest: ${weekdays.filter((_, day) => !pattern.includes(day)).join(' · ')}`} selected={pattern.join() === trainingDays.join()} onPress={() => setTrainingDays(pattern)} />)}
        {daysPerWeek === 4 && <Text style={s.muted}>Four days includes consecutive training days. Adjust your week when you need more recovery.</Text>}
      </>}
      {step === 3 && <><Text style={s.muted}>Total weight, including the bar. Leave any field blank for an empty {barWeight(unit)} {unit} bar. Hints are a starting guide; they never change your weights.</Text>{lifts.map(lift => <View key={lift} style={s.card}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${liftNames[lift]} exercise guide`} onPress={() => setGuideLift(lift)} style={styles.columns}><LiftIllustration lift={lift} /><View style={{ flex: 1, gap: 6 }}><Text style={s.heading}>{liftNames[lift]}</Text><Text style={styles.pill}>{lift === 'deadlift' ? '1 × 5' : '5 × 5'} · {unit.toUpperCase()}</Text><Text style={s.muted}>Form guide ↗</Text></View></Pressable>
        <Text style={s.muted}>{startingWeightHint(experience, goal, lift)}</Text>
        <Field label={`${liftNames[lift]} starting weight (${unit})`} keyboardType="decimal-pad" value={values[lift] ?? ''} placeholder={String(barWeight(unit))} onChangeText={value => { setWeights(current => ({ ...current, [unit]: { ...current[unit], [lift]: value } })); setErrors(current => ({ ...current, [lift]: undefined })); }} onBlur={() => { try { setupTraining(unit, { [lift]: values[lift] }); } catch { setErrors(current => ({ ...current, [lift]: `Enter a finite weight of 0 ${unit} or more.` })); } }} />
        {errors[lift] && <Message>{errors[lift]}</Message>}
      </View>)}</>}
      {step === 4 && <>
        <View style={[s.card, styles.selected]}><Text style={s.eyebrow}>BUILT AROUND YOU</Text><Text style={s.heading}>{goals.find(([key]) => key === goal)![1]}</Text><Text style={s.text}>{experiences.find(([key]) => key === experience)![1]}</Text><Text style={s.text}>{daysPerWeek} days / week · {trainingDays.map(day => weekdays[day]).join(' · ')}</Text><Text style={s.muted}>Rest: {weekdays.filter((_, day) => !trainingDays.includes(day)).join(' · ')}</Text></View>
        <View style={s.card}><Text style={s.heading}>Your starting weights</Text>{lifts.map(lift => <View key={lift} style={s.row}><Pressable accessibilityRole="button" accessibilityLabel={`Open ${liftNames[lift]} exercise guide`} onPress={() => setGuideLift(lift)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={s.text}>{liftNames[lift]}</Text><Text style={s.muted}>Form guide ↗</Text></Pressable><Text style={styles.choiceTitle}>{values[lift]?.trim() ? Number(values[lift]) : barWeight(unit)} {unit}</Text></View>)}</View>
        <Text style={s.muted}>Start with workout A: squat, bench press and barbell row. Your plan saves on this device. No account needed.</Text>
      </>}
      {!!error && <Message>{error}</Message>}
      <Button title={step === 4 ? (saving ? 'Saving…' : 'Done — build my plan') : 'Continue →'} disabled={saving} onPress={step === 4 ? finish : advance} />
      {step > 0 && <Button title="← Back" secondary disabled={saving} onPress={() => { setStep(current => current - 1); setError(''); }} />}
      <Text style={s.footer}>SHOW UP. GET STRONGER.</Text>
    </>}
  </View></ScrollView><ExerciseGuideModal lift={guideLift} onClose={() => setGuideLift(null)} /></SafeAreaView>;
}
const styles = StyleSheet.create({
  choice: { minHeight: 56, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12 },
  selected: { borderColor: '#F04C5B', backgroundColor: '#2C191E' },
  choiceTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '700' },
  columns: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pill: { color: '#FF8A94', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
});
