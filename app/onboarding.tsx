import { useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useTraining } from '../src/state/store';
import { liftNames, lifts, setupTraining, type Profile } from '../src/training/flows';
import { barWeight, type Unit } from '../src/training/engine';
import { Button, Field, Loading, Message, Screen, s } from '../src/ui/common';

export default function Onboarding() {
  const { data, ready, saving, error: storageError, update } = useTraining();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [experience, setExperience] = useState<Profile['experience']>('new');
  const [goal, setGoal] = useState<Profile['goal']>('strength');
  const [unit, setUnit] = useState<Unit>(data.training.unit);
  const [values, setValues] = useState<Partial<Record<(typeof lifts)[number], string>>>({});
  const [error, setError] = useState('');
  if (!ready) return <Screen title="Your starting point">{storageError ? <Message>{storageError}</Message> : <Loading>Loading training…</Loading>}</Screen>;
  if (data.profile) return <Redirect href="/" />;
  async function finish() {
    try { const training = setupTraining(unit, values); await update(current => ({ ...current, profile: { experience, goal }, training })); router.replace('/'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save setup. Please retry.'); }
  }
  return <Screen title={['Start where you are.', 'What drives you?', 'Find your starting weight.'][step]} eyebrow={`YOUR PLAN · STEP ${step + 1} OF 3`}>
    {step === 0 && <><Text style={s.muted}>How familiar are you with barbell training?</Text>{([['new', 'New to lifting'], ['returning', 'Getting back into it'], ['experienced', 'Already lifting']] as const).map(([key, label]) => <Button key={key} title={`${experience === key ? '✓ ' : ''}${label}`} secondary={experience !== key} onPress={() => setExperience(key)} />)}</>}
    {step === 1 && <><Text style={s.muted}>Choose your main goal. Every goal uses the same focused A/B strength program.</Text>{(['strength', 'size', 'confidence'] as const).map(key => <Button key={key} title={`${goal === key ? '✓ ' : ''}${key[0].toUpperCase() + key.slice(1)}`} secondary={goal !== key} onPress={() => setGoal(key)} />)}</>}
    {step === 2 && <><Text style={s.muted}>Total weight, including the bar. Leave fields blank to start with an empty {barWeight(unit)} {unit} bar. Choose a weight you can lift with control.</Text><View style={s.row}>{(['kg', 'lb'] as const).map(value => <Button key={value} title={`${unit === value ? '✓ ' : ''}${value}`} secondary={unit !== value} onPress={() => { if (unit !== value) { setUnit(value); setValues({}); setError(''); } }} />)}</View><Text style={s.muted}>Changing units here resets starting weights to the empty bar.</Text>{lifts.map(lift => <Field key={lift} label={`${liftNames[lift]} (${unit})`} keyboardType="decimal-pad" value={values[lift] || ''} placeholder={String(barWeight(unit))} onChangeText={value => setValues(current => ({ ...current, [lift]: value }))} />)}</>}
    {!!error && <Message>{error}</Message>}
    {step < 2 ? <Button title="Continue" onPress={() => setStep(step + 1)} /> : <Button title={saving ? 'Saving…' : 'Build my plan'} disabled={saving} onPress={finish} />}
    {step > 0 && <Button title="Back" secondary disabled={saving} onPress={() => { setStep(step - 1); setError(''); }} />}
  </Screen>;
}
