import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useTraining } from '../src/state/store';
import { changeUnit } from '../src/training/flows';
import { Button, Loading, Message, Screen, s } from '../src/ui/common';
export default function Settings() {
  const { data, ready, saving, error: storageError, update } = useTraining();
  const [error, setError] = useState('');
  const router = useRouter();
  return <Screen title="Keep it simple." eyebrow="SETTINGS">
    {!ready ? (storageError ? <Message>{storageError}</Message> : <Loading>Loading training…</Loading>) : <>
      <View style={s.card}><Text style={s.heading}>Weight units</Text><View style={s.row}>{(['kg', 'lb'] as const).map(unit => <Button key={unit} title={`${data.training.unit === unit ? '✓ ' : ''}${unit === 'kg' ? 'Kilograms' : 'Pounds'}`} secondary={data.training.unit !== unit} disabled={saving || !!data.draft} onPress={async () => { try { await update(current => changeUnit(current, unit)); setError(''); } catch (err) { setError(err instanceof Error ? err.message : 'Could not save units.'); } }} />)}</View><Text style={s.muted}>{data.draft ? 'Finish your active workout to change units.' : 'Current targets convert to the nearest loadable weight (2.5 kg / 5 lb steps). History keeps its original units.'}</Text></View>
      {data.profile && <View style={s.card}><Text style={s.heading}>Your plan</Text><Text style={s.text}>Experience: {data.profile.experience}</Text><Text style={s.text}>Goal: {data.profile.goal}</Text><Text style={s.muted}>Classic A/B · 5 × 5 · Deadlift 1 × 5</Text></View>}
      {!!error && <Message>{error}</Message>}
    </>}
    <View style={s.card}><Text style={s.heading}>Account</Text><Text style={s.muted}>Email and password sign-in. Training is stored on this device only, including when signed in. Cloud sync is not available yet.</Text><Button title="Manage sign-in" onPress={() => router.push('/auth')} /></View>
  </Screen>;
}
