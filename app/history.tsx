import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTraining } from '../src/state/store';
import { liftNames, lifts } from '../src/training/flows';
import { workoutDefinition, workoutName } from '../src/training/engine';
import { Button, Loading, Message, Screen, s } from '../src/ui/common';
export default function History() {
  const { data, ready, error } = useTraining();
  const router = useRouter();
  return <Screen title="Your progress." eyebrow="ONE SESSION AT A TIME">
    {!ready ? (error ? <Message>{error}</Message> : <Loading>Loading training…</Loading>) : !data.profile ? <Button title="Set up my training" onPress={() => router.push('/onboarding')} /> : <>
      <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Current targets</Text><Text style={s.muted}>Working weights for your next sessions.</Text>{lifts.map(lift => <View key={lift} style={s.row}><Text style={s.text}>{liftNames[lift]}</Text><Text style={s.text}>{data.training.lifts[lift].weight} {data.training.unit}</Text></View>)}</View>
      <Text accessibilityRole="header" style={s.heading}>Workout history · {data.history.length}</Text>
      {!data.history.length && <View style={s.card}><Text style={s.text}>Your first session is waiting.</Text><Text style={s.muted}>Completed workouts appear here with the weights and reps you logged.</Text><Button title="Go to today" onPress={() => router.push('/')} /></View>}
      {data.history.map(entry => <View key={entry.id} style={s.card}><Text style={s.heading}>Workout {workoutName(entry.training)}</Text><Text style={s.muted}>{new Date(entry.completedAt).toLocaleString()}</Text>{workoutDefinition(entry.training.nextWorkout, entry.training.program).map(({ lift }) => <View key={lift} style={{ gap: 4 }}><Text style={s.text}>{liftNames[lift]} · {entry.training.lifts[lift].weight} {entry.training.unit}</Text><Text style={s.muted}>{entry.reps[lift]?.join(' / ')} reps</Text></View>)}</View>)}
    </>}
  </Screen>;
}
