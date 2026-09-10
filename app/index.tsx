import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isSupabaseConfigured } from '../src/lib/supabase';
import { theme } from '../src/theme';

const workouts = {
  A: ['Squat', 'Bench press', 'Barbell row'],
  B: ['Squat', 'Overhead press', 'Deadlift'],
} as const;

export default function HomeScreen() {
  const [workout, setWorkout] = useState<'A' | 'B'>('A');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.brand}>IRON<Text style={styles.red}>TRACK</Text></Text>
            <View style={styles.badge}><Text style={styles.badgeText}>5 × 5</Text></View>
          </View>

          <View style={styles.hero}>
            <Text style={styles.eyebrow}>SHOW UP. GET STRONGER.</Text>
            <Text accessibilityRole="header" style={styles.title}>One lift at{ '\n' }a time.</Text>
            <Text style={styles.subtitle}>Simple workouts. Steady progress.{ '\n' }Your strength, on your terms.</Text>
          </View>

          <View style={styles.sectionHeading}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Your training</Text>
            <Text style={styles.muted}>PROGRAM PREVIEW</Text>
          </View>
          <View accessibilityRole="tablist" style={styles.tabs}>
            {(['A', 'B'] as const).map((item) => (
              <Pressable
                key={item}
                accessibilityRole="tab"
                accessibilityState={{ selected: item === workout }}
                onPress={() => setWorkout(item)}
                style={({ pressed }) => [styles.tab, item === workout && styles.activeTab, pressed && styles.pressed]}
              >
                <Text style={styles.tabText}>Workout {item}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeading}>
              <Text style={styles.cardTitle}>The big three.</Text>
              <Text style={styles.cardSubtitle}>3 exercises · barbell fundamentals</Text>
            </View>
            {workouts[workout].map((exercise, index) => (
              <View key={exercise} style={styles.exercise}>
                <Text style={styles.number}>0{index + 1}</Text>
                <Text style={styles.exerciseName}>{exercise}</Text>
                <Text style={styles.sets}>{exercise === 'Deadlift' ? '1 × 5' : '5 × 5'}</Text>
              </View>
            ))}
            <View style={styles.note}>
              <Text style={styles.noteText}>Workout logging is coming next. Explore A and B to preview the program.</Text>
            </View>
          </View>

          <View style={styles.foundation}>
            <View style={styles.accent} />
            <View style={styles.foundationText}>
              <Text style={styles.sectionTitle}>Built for the long run.</Text>
              <Text style={styles.description}>A focused home for your lifts, without the noise. Start with the basics and build from there.</Text>
            </View>
          </View>
          <Text style={styles.footer}>ROUND 01 · APP FOUNDATION</Text>
          <Text style={styles.connection}>
            {isSupabaseConfigured ? 'Supabase configured · connection not tested' : 'Preview mode · no account needed'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const c = theme.colors;
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 28 },
  container: { width: '100%', maxWidth: theme.maxWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: c.text, fontSize: 23, fontWeight: '900', letterSpacing: -1 },
  red: { color: c.red },
  badge: { backgroundColor: c.red, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  badgeText: { color: c.text, fontWeight: '900', fontSize: 15 },
  hero: { paddingTop: 52, paddingBottom: 40 },
  eyebrow: { color: c.red, fontSize: 11, letterSpacing: 2, fontWeight: '800', marginBottom: 18 },
  title: { color: c.text, fontSize: 52, lineHeight: 55, fontWeight: '900', letterSpacing: -2 },
  subtitle: { color: c.muted, fontSize: 16, lineHeight: 25, marginTop: 20 },
  sectionHeading: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  sectionTitle: { color: c.text, fontSize: 18, fontWeight: '700' },
  muted: { color: c.muted, fontSize: 10, letterSpacing: 1 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16, backgroundColor: c.surface, padding: 5, borderRadius: 12 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 8 },
  activeTab: { backgroundColor: c.red },
  pressed: { opacity: 0.8 },
  tabText: { color: c.text, fontSize: 15, fontWeight: '700' },
  card: { backgroundColor: c.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  cardHeading: { padding: 22 },
  cardTitle: { color: c.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  cardSubtitle: { color: c.muted, fontSize: 13, marginTop: 6 },
  exercise: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 21, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: c.border },
  number: { color: c.muted, fontSize: 12, fontWeight: '600' },
  exerciseName: { flex: 1, color: c.text, fontSize: 16, fontWeight: '600' },
  sets: { color: c.text, fontSize: 16, fontWeight: '800' },
  note: { padding: 20, borderTopWidth: 1, borderTopColor: c.border },
  noteText: { color: c.muted, fontSize: 13, lineHeight: 20 },
  foundation: { flexDirection: 'row', gap: 16, marginTop: 32, marginBottom: 36 },
  accent: { width: 3, backgroundColor: c.red, borderRadius: 2 },
  foundationText: { flex: 1 },
  description: { color: c.muted, fontSize: 14, lineHeight: 22, marginTop: 8 },
  footer: { color: c.muted, fontSize: 10, letterSpacing: 2, textAlign: 'center' },
  connection: { color: c.muted, fontSize: 11, marginTop: 10, textAlign: 'center' },
});
