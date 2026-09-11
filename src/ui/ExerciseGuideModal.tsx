import { useState } from 'react';
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Lift } from '../training/engine';
import { EXERCISE_GUIDES, guideThumbnailUrl } from '../training/exerciseGuides';
import { theme } from '../theme';
import { Button, Message, s } from './common';
import { LiftIllustration } from './LiftIllustration';

export function ExerciseGuideModal({ lift, onClose }: { lift: Lift | null; onClose: () => void }) {
  if (!lift) return null;
  return <Guide key={lift} lift={lift} onClose={onClose} />;
}

function Guide({ lift, onClose }: { lift: Lift; onClose: () => void }) {
  const guide = EXERCISE_GUIDES[lift];
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [error, setError] = useState('');
  async function openVideo() {
    setError('');
    try { await Linking.openURL(guide.videoUrl); }
    catch { setError('Could not open YouTube. Try again when you are online.'); }
  }
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <SafeAreaView style={styles.overlay}>
      <View accessibilityViewIsModal style={styles.sheet}>
        <View style={styles.header}><Text style={s.eyebrow}>EXERCISE GUIDE</Text><Button title="Close guide" secondary onPress={onClose} /></View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text accessibilityRole="header" style={s.heading}>{guide.name}</Text>
          <Text style={s.text}>{guide.description}</Text>
          <Text accessibilityRole="header" style={s.heading}>Form cues</Text>
          {guide.cues.map((cue, index) => <Text key={cue} style={s.text}>{index + 1}. {cue}</Text>)}
          <Pressable accessibilityRole="link" accessibilityLabel={`Watch ${guide.title} by ${guide.source} on YouTube. Opens externally.`} onPress={openVideo} style={({ pressed }) => [s.card, pressed && { opacity: 0.7 }]}>
            <View style={styles.thumbnail}>
              <LiftIllustration lift={lift} />
              {!thumbnailFailed && <Image accessible={false} source={{ uri: guideThumbnailUrl(guide) }} onError={() => setThumbnailFailed(true)} style={StyleSheet.absoluteFill} resizeMode="cover" />}
              <Text style={styles.play}>▶ YouTube</Text>
            </View>
            <Text style={s.text}>{guide.title}</Text><Text style={s.muted}>{guide.source}</Text>
            <Text style={s.buttonText}>Watch form video ↗</Text>
          </Pressable>
          {!!error && <Message>{error}</Message>}
          <Text style={s.muted}>Cues are available offline. Video playback requires internet and opens YouTube.</Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: '#000000BB' },
  sheet: { width: '100%', maxWidth: theme.maxWidth, maxHeight: '100%', alignSelf: 'center', flexShrink: 1, borderRadius: 20, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  header: { padding: 16, gap: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' },
  content: { padding: 20, gap: 16 },
  thumbnail: { width: '100%', aspectRatio: 4 / 3, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderRadius: 10, overflow: 'hidden' },
  play: { position: 'absolute', bottom: 8, right: 8, color: 'white', backgroundColor: '#000000CC', padding: 8, borderRadius: 6, fontWeight: '700' },
});
