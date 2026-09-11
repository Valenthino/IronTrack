import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Text, View } from 'react-native';
import { useTraining } from '../state/store';
import { dateKey, defaultReminder, reminderDue, saveReminder } from '../training/progress';
import { Button, Field, Message, s } from './common';
const supported = () => Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window;
export function ReminderSettings() {
  const { data, saving, update } = useTraining();
  const [value, setValue] = useState(data.reminder ?? defaultReminder());
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [permission, setPermission] = useState(supported() ? Notification.permission : 'unsupported');
  return <View style={s.card}><Text style={s.heading}>Workout reminders</Text>
    <Button title={`Reminders: ${value.enabled ? 'On' : 'Off'}`} secondary={!value.enabled} onPress={() => setValue({ ...value, enabled: !value.enabled })} />
    <View style={s.row}>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => <Button key={day} title={`${value.days.includes(index) ? '✓ ' : ''}${day}`} secondary={!value.days.includes(index)} onPress={() => setValue({ ...value, days: value.days.includes(index) ? value.days.filter(item => item !== index) : [...value.days, index] })} />)}</View>
    <Field label="Reminder time (HH:MM, local time)" value={value.time} onChangeText={time => setValue({ ...value, time })} placeholder="18:00" />
    <Button title="Save reminders" disabled={saving} onPress={async () => { try { await update(current => saveReminder(current, value)); setFailed(false); setMessage('Reminder settings saved.'); } catch (err) { setFailed(true); setMessage(err instanceof Error ? err.message : 'Could not save reminders.'); } }} />
    <Text style={s.muted}>A banner appears after your chosen time on selected days until you start or finish a workout, or dismiss it for the day. Reminders use this device’s local clock. The app must be open; closed-app delivery is not supported. No email, SMS, or sync.</Text>
    <Text style={s.muted}>Browser notifications: {permission}. The in-app banner works without notification permission.</Text>
    {supported() && permission === 'default' && <Button title="Enable browser notifications" secondary onPress={async () => { try { setPermission(await Notification.requestPermission()); } catch { setFailed(true); setMessage('Browser notifications are unavailable. In-app reminders still work.'); } }} />}
    {permission === 'denied' && <Text style={s.muted}>To allow notifications, change this site’s notification permission in your browser settings.</Text>}
    {!!message && <Message tone={failed ? 'error' : 'success'}>{message}</Message>}
  </View>;
}
export function ReminderBanner() {
  const { data, ready, saving, update } = useTraining();
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState('');
  const notified = useRef('');
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = setInterval(refresh, 15000);
    const subscription = AppState.addEventListener('change', refresh);
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  const due = ready && !!data.profile && reminderDue(data, now);
  useEffect(() => {
    if (!due || !supported() || Notification.permission !== 'granted') return;
    const key = dateKey(now);
    if (notified.current === key) return;
    notified.current = key;
    // sessionStorage prevents repeated delivery on navigation/reload within this tab.
    try {
      if (window.sessionStorage.getItem('irontrack.reminder.notified') === key) return;
      const notification = new Notification('IronTrack · Time to lift', { body: 'Your next workout is ready. One session at a time.', tag: 'irontrack-workout' });
      notification.onclick = () => { window.focus(); notification.close(); };
      window.sessionStorage.setItem('irontrack.reminder.notified', key);
    } catch { /* Unsupported constructors/storage do not prevent the in-app banner. */ }
  }, [due, now]);
  if (!due) return null;
  return <View style={s.card}><Text accessibilityRole="alert" style={s.heading}>Time to lift. Your next workout is ready.</Text><Text style={s.muted}>Open Today when you’re ready. A little consistency goes a long way.</Text><Button title="Dismiss for today" secondary disabled={saving} onPress={async () => { try { await update(current => ({ ...current, reminder: { ...(current.reminder ?? defaultReminder()), dismissed: dateKey(new Date()) } })); setError(''); } catch { setError('Could not dismiss. Please retry.'); } }} />{!!error && <Message>{error}</Message>}</View>;
}
