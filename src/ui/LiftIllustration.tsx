import { View } from 'react-native';
import type { Lift } from '../training/engine';

// Scalable geometric line art, built from native primitives on every platform.
const poses: Record<Lift, { head: [number, number]; lines: number[][]; bar: number }> = {
  squat: { head: [48, 19], lines: [[52, 33, 44, 57], [44, 57, 65, 66], [65, 66, 52, 86], [52, 39, 29, 35]], bar: 34 },
  bench_press: { head: [23, 53], lines: [[36, 62, 67, 62], [67, 62, 77, 84], [44, 61, 46, 32], [17, 70, 71, 70]], bar: 29 },
  barbell_row: { head: [39, 28], lines: [[46, 40, 66, 52], [66, 52, 58, 69], [58, 69, 68, 87], [47, 42, 38, 65]], bar: 65 },
  overhead_press: { head: [47, 31], lines: [[51, 45, 51, 65], [51, 65, 35, 88], [51, 65, 67, 88], [51, 47, 29, 18], [51, 47, 74, 18]], bar: 16 },
  deadlift: { head: [46, 21], lines: [[50, 35, 56, 58], [56, 58, 39, 86], [56, 58, 70, 86], [49, 38, 36, 62], [53, 38, 68, 62]], bar: 64 },
};
export function LiftIllustration({ lift }: { lift: Lift }) {
  const pose = poses[lift];
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 104, height: 104, backgroundColor: '#301B22', borderRadius: 20, overflow: 'hidden' }}>
    <View style={{ position: 'absolute', left: 12, top: 91, width: 80, height: 1, backgroundColor: '#71414B' }} />
    {pose.lines.map(([x1, y1, x2, y2], i) => <View key={i} style={{ position: 'absolute', left: (x1 + x2) / 2 - Math.hypot(x2 - x1, y2 - y1) / 2, top: (y1 + y2) / 2 - 2, width: Math.hypot(x2 - x1, y2 - y1), height: 4, borderRadius: 4, backgroundColor: '#EBD7DB', transform: [{ rotate: `${Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI}deg` }] }} />)}
    <View style={{ position: 'absolute', left: pose.head[0], top: pose.head[1], width: 12, height: 12, borderRadius: 6, backgroundColor: '#EBD7DB' }} />
    <View style={{ position: 'absolute', left: 15, top: pose.bar, width: 74, height: 3, backgroundColor: '#FF6672' }} />
    {[19, 79].map(left => <View key={left} style={{ position: 'absolute', left, top: pose.bar - 7, width: 6, height: 18, borderRadius: 2, backgroundColor: '#FF6672' }} />)}
  </View>;
}
