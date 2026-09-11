import { ReminderBanner } from './Reminders';
import { type ReactNode } from 'react';
import { Link, usePathname } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
export function Button({ title, onPress, disabled, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, (pressed || disabled) && { opacity: 0.5 }]}><Text style={s.buttonText}>{title}</Text></Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) { return <View style={{ gap: 8 }}><Text style={s.text}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={c.borderMuted} {...props} style={[s.input, props.style]} /></View>; }
export function Message({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'success' }) { return <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[s.message, tone === 'success' && s.messageSuccess]}>{children}</Text>; }
export function Loading({ children = 'Loading…' }: { children?: ReactNode }) { return <Text accessibilityRole="progressbar" accessibilityLiveRegion="polite" style={s.muted}>{children}</Text>; }
export function Screen({ title, eyebrow, children }: { title: string; eyebrow?: string; children: ReactNode }) {
  const pathname = usePathname();
  return <SafeAreaView style={s.safe}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}><View style={s.container}>
    <View style={s.row}><Text style={s.brand}>IRON<Text style={{ color: theme.colors.red }}>TRACK</Text></Text><Text style={s.badge}>5 × 5</Text></View>
    <View style={s.nav}>{([{ href: '/', label: 'Today' }, { href: '/history', label: 'History' }, { href: '/settings', label: 'Settings' }] as const).map(item => <Link key={item.href} href={item.href} asChild><Pressable accessibilityRole="link" accessibilityState={{ selected: pathname === item.href }} style={StyleSheet.flatten([s.navItem, pathname === item.href && s.navActive])}><Text style={s.buttonText}>{item.label}</Text></Pressable></Link>)}</View>
    <ReminderBanner />
    {eyebrow && <Text style={s.eyebrow}>{eyebrow}</Text>}<Text accessibilityRole="header" style={s.title}>{title}</Text>{children}
    <Text style={s.footer}>SHOW UP. GET STRONGER.</Text>
  </View></ScrollView></SafeAreaView>;
}
const c = theme.colors;
export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, scroll: { flexGrow: 1, padding: 20 }, container: { width: '100%', maxWidth: theme.maxWidth, alignSelf: 'center', gap: 18 },
  brand: { color: c.text, fontSize: 24, fontWeight: '900', letterSpacing: -1 }, badge: { backgroundColor: c.red, color: 'white', padding: 10, borderRadius: 8, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }, nav: { flexDirection: 'row', gap: 6, paddingVertical: 12 }, navItem: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: c.surface }, navActive: { borderBottomWidth: 3, borderColor: c.red },
  eyebrow: { color: '#FF6672', fontSize: 12, fontWeight: '800', letterSpacing: 2 }, title: { color: c.text, fontSize: 40, fontWeight: '900', letterSpacing: -1.5 }, heading: { color: c.text, fontSize: 22, fontWeight: '800' }, text: { color: c.text, fontSize: 16, lineHeight: 24 }, muted: { color: c.muted, fontSize: 14, lineHeight: 22 },
  card: { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 20, gap: 16 }, button: { backgroundColor: c.red, minHeight: 50, borderRadius: 10, padding: 14, alignItems: 'center', justifyContent: 'center' }, secondary: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderMuted }, buttonText: { color: 'white', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  input: { backgroundColor: c.text, color: c.background, minHeight: 52, padding: 14, borderRadius: 8, fontSize: 18 }, message: { color: c.alert, fontSize: 14, lineHeight: 22 }, messageSuccess: { color: c.success }, footer: { color: c.muted, fontSize: 11, letterSpacing: 2, textAlign: 'center', marginVertical: 20 },
});
