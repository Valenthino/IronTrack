import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useTraining } from '../src/state/store';
import { changeProgram, liftNames, lifts } from '../src/training/flows';
import { presetProgram, type Preset, type Program, type ProgramDay } from '../src/training/engine';
import { Button, Field, Loading, Message, Screen, s } from '../src/ui/common';

export default function ProgramScreen() {
  const { data, ready, saving, error: storageError, update } = useTraining();
  const [plan, setPlan] = useState<Program>(data.training.program);
  const [pending, setPending] = useState<Preset | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { setPlan(data.training.program); }, [data.training.program]);
  const disabled = saving || !!data.draft;
  function edit(next: Program) { setPlan(next); setSaved(false); setError(''); }
  function editDay(id: string, change: (day: ProgramDay) => ProgramDay) {
    edit({ ...plan, days: plan.days.map(day => day.id === id ? change(day) : day) });
  }
  function move<T>(items: readonly T[], index: number, offset: number): T[] {
    const next = [...items];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    return next;
  }
  async function save(next: Program, restart = false) {
    try { await update(current => changeProgram(current, next, restart)); setPending(null); setError(''); setSaved(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save program.'); }
  }
  if (!ready) return <Screen title="Plan / Program">{storageError ? <Message>{storageError}</Message> : <Loading />}</Screen>;
  return <Screen title="Your program." eyebrow="PLAN / PROGRAM">
    <Text style={s.muted}>Days rotate in the order below, regardless of days per week. Every lift uses 5 × 5, except deadlift at 1 × 5. Targets are shared wherever a lift appears.</Text>
    {!!data.draft && <Message>Finish your active workout before changing your program.</Message>}
    <View style={s.card}><Text style={s.heading}>Presets</Text>
      {(['classic', 'ppl', 'upper_lower'] as const).map(preset => <Button key={preset} title={presetProgram(preset).name} secondary disabled={disabled} onPress={() => { setPending(preset); setSaved(false); }} />)}
      {pending && <><Message>Replace your current plan and unsaved edits with {presetProgram(pending).name}? Rotation starts at its first day. Your history and lift targets will be preserved.</Message><Button title="Replace plan" disabled={disabled} onPress={() => save(presetProgram(pending), true)} /><Button title="Cancel replacement" secondary disabled={saving} onPress={() => setPending(null)} /></>}
    </View>
    <Field label="Program name" value={plan.name} editable={!disabled} onChangeText={name => edit({ ...plan, name })} />
    <Text style={s.heading}>Days per week</Text><View style={s.row}>{[1, 2, 3, 4, 5, 6, 7].map(daysPerWeek => <Button key={daysPerWeek} title={`${daysPerWeek}${plan.daysPerWeek === daysPerWeek ? ' ✓' : ''}`} secondary={plan.daysPerWeek !== daysPerWeek} disabled={disabled} onPress={() => edit({ ...plan, daysPerWeek })} />)}</View>
    {plan.days.map((day, index) => <View key={day.id} style={s.card}>
      <Field label={`Day ${index + 1} name`} value={day.name} editable={!disabled} onChangeText={name => editDay(day.id, current => ({ ...current, name }))} />
      <View style={s.row}><Button title="Day up" secondary disabled={disabled || index === 0} onPress={() => edit({ ...plan, days: move(plan.days, index, -1) })} /><Button title="Day down" secondary disabled={disabled || index === plan.days.length - 1} onPress={() => edit({ ...plan, days: move(plan.days, index, 1) })} /><Button title="Remove day" secondary disabled={disabled || plan.days.length === 1} onPress={() => edit({ ...plan, days: plan.days.filter(item => item.id !== day.id) })} /></View>
      {day.lifts.map((lift, liftIndex) => <View key={lift} style={{ gap: 8 }}><Text style={s.text}>{liftIndex + 1}. {liftNames[lift]}</Text><View style={s.row}>
        <Button title={`${liftNames[lift]} up`} secondary disabled={disabled || liftIndex === 0} onPress={() => editDay(day.id, current => ({ ...current, lifts: move(current.lifts, liftIndex, -1) }))} />
        <Button title={`Remove ${liftNames[lift]}`} secondary disabled={disabled} onPress={() => editDay(day.id, current => ({ ...current, lifts: current.lifts.filter(item => item !== lift) }))} />
      </View></View>)}
      {lifts.filter(lift => !day.lifts.includes(lift)).map(lift => <Button key={lift} title={`Add ${liftNames[lift]}`} secondary disabled={disabled} onPress={() => editDay(day.id, current => ({ ...current, lifts: [...current.lifts, lift] }))} />)}
    </View>)}
    <Button title="Add day" secondary disabled={disabled} onPress={() => edit({ ...plan, days: [...plan.days, { id: `day-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: `Day ${plan.days.length + 1}`, lifts: [] }] })} />
    <Text style={s.muted}>To create a custom program, name it and edit or add days. Each day needs a name and at least one lift. Save to apply your changes.</Text>
    <Button title={saving ? 'Saving…' : 'Save program'} disabled={disabled || !!pending} onPress={() => save(plan)} />
    {!!(error || storageError) && <Message>{error || storageError}</Message>}
    {saved && <Message tone="success">Program saved on this device.</Message>}
  </Screen>;
}
