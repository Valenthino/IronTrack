import { useState } from 'react';
import { Text, View } from 'react-native';
import { theme } from '../theme';
import { s } from './common';
/** Small native View plot: no chart runtime, same renderer on web and native. */
export function ProgressChart({ points, unit }: { points: { date: string; weight: number }[]; unit: string }) {
  const [width, setWidth] = useState(240);
  if (!points.length) return <Text style={s.muted}>Your first log starts this graph. Keep showing up.</Text>;
  const min = Math.min(...points.map(p => p.weight));
  const max = Math.max(...points.map(p => p.weight));
  const coords = points.map((point, index) => ({ x: 8 + (points.length === 1 ? 0.5 : index / (points.length - 1)) * (width - 16), y: 100 - (max === min ? 0.5 : (point.weight - min) / (max - min)) * 88 }));
  return <View style={{ gap: 8 }}>
    <Text style={s.muted}>{min.toFixed(1)}–{max.toFixed(1)} {unit} · {points.length} logs</Text>
    <View accessible accessibilityLabel={points.map(p => `${p.date}: ${p.weight.toFixed(1)} ${unit}`).join('; ')} onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ height: 116, borderBottomWidth: 1, borderColor: theme.colors.borderMuted }}>
      {coords.slice(1).map((point, i) => { const previous = coords[i]; const dx = point.x - previous.x; const dy = point.y - previous.y; const length = Math.hypot(dx, dy); return <View key={`line-${i}`} style={{ position: 'absolute', left: (point.x + previous.x - length) / 2, top: (point.y + previous.y) / 2, width: length, height: 2, backgroundColor: theme.colors.red, transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }] }} />; })}
      {coords.map((point, i) => <View key={i} style={{ position: 'absolute', left: point.x - 4, top: point.y - 3, width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.red }} />)}
    </View>
    <View style={s.row}><Text style={s.muted}>{points[0].date}</Text><Text style={s.muted}>{points[points.length - 1].date}</Text></View>
  </View>;
}
