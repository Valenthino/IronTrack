import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { barWeight, increment } from '../src/training/engine';
import { useTraining } from '../src/state/store';
import { changeEquipment, changeUnit } from '../src/training/flows';
import { Button, Field, Loading, Message, Screen, s } from '../src/ui/common';
export default function Settings() {
  const { data, ready, saving, error: storageError, update } = useTraining();
  const [error, setError] = useState('');
  const router = useRouter();
  const [bar, setBar] = useState('');
  useEffect(() => { setBar(data.training.customBarWeight === null ? '' : String(data.training.customBarWeight)); }, [data.training.customBarWeight, data.training.unit]);
  async function saveEquipment(microloading: boolean, customBarWeight: number | null) {
    try { await update(current => changeEquipment(current, microloading, customBarWeight)); setError(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save equipment.'); }
  }
  return <Screen title="Keep it simple." eyebrow="SETTINGS">
    {!ready ? (storageError ? <Message>{storageError}</Message> : <Loading>Loading training…</Loading>) : <>
      <View style={s.card}><Text style={s.heading}>Weight units</Text><View style={s.row}>{(['kg', 'lb'] as const).map(unit => <Button key={unit} title={`${data.training.unit === unit ? '✓ ' : ''}${unit === 'kg' ? 'Kilograms' : 'Pounds'}`} secondary={data.training.unit !== unit} disabled={saving || !!data.draft} onPress={async () => { try { await update(current => changeUnit(current, unit)); setError(''); } catch (err) { setError(err instanceof Error ? err.message : 'Could not save units.'); } }} />)}</View><Text style={s.muted}>{data.draft ? 'Finish your active workout to change units.' : `Current targets convert to the nearest ${increment(data.training.unit, data.training.microloading)} ${data.training.unit} step. History keeps its original units.`}</Text></View>
      <View style={s.card}><Text style={s.heading}>Equipment</Text>
        <Button title={`Microloading: ${data.training.microloading ? 'On' : 'Off'}`} secondary={!data.training.microloading} disabled={saving || !!data.draft} onPress={() => saveEquipment(!data.training.microloading, data.training.customBarWeight)} />
        <Text style={s.muted}>Progression: {increment(data.training.unit, data.training.microloading)} {data.training.unit} per successful lift. Microloading uses matched 0.625 kg / 1.25 lb plates.</Text>
        <Field label={`Custom bar weight (${data.training.unit})`} keyboardType="decimal-pad" editable={!saving && !data.draft} value={bar} placeholder={String(barWeight(data.training.unit))} onChangeText={setBar} />
        <Text style={s.muted}>Leave blank for the standard bar. Any weight of 0 or more is supported, including a 40 lb bar. Current lift targets stay as entered.</Text>
        <Button title="Save bar weight" disabled={saving || !!data.draft} onPress={() => saveEquipment(data.training.microloading, bar.trim() === '' ? null : Number(bar))} />
        {!!data.draft && <Text style={s.muted}>Finish your active workout to change equipment.</Text>}
      </View>
      {data.profile && <View style={s.card}><Text style={s.heading}>Your plan</Text><Text style={s.text}>Experience: {data.profile.experience}</Text><Text style={s.text}>Goal: {data.profile.goal}</Text><Text style={s.muted}>{data.training.program.name} · {data.training.program.daysPerWeek} days/week · Deadlift 1 × 5</Text><Button title="Edit plan / program" secondary onPress={() => router.push('/program')} /></View>}
      {!!error && <Message>{error}</Message>}
    </>}
    <View style={s.card}><Text style={s.heading}>Account</Text><Text style={s.muted}>Email and password sign-in. Training is stored on this device only, including when signed in. Cloud sync is not available yet.</Text><Button title="Manage sign-in" onPress={() => router.push('/auth')} /></View>
  </Screen>;
}
