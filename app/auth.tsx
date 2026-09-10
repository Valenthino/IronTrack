import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { getSupabase, isSupabaseConfigured } from '../src/lib/supabase';
import { validEmail } from '../src/training/flows';
import { Button, Field, Message, Screen, s } from '../src/ui/common';

export default function Auth() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [available, setAvailable] = useState(isSupabaseConfigured);
  useEffect(() => {
    try {
      const client = getSupabase();
      if (!client) return;
      let active = true;
      client.auth.getSession().then(({ data, error }) => { if (active) { setSignedIn(!!data.session); if (error) setMessage('Unable to restore your sign-in. Please sign in again.'); } }).catch(() => { if (active) setMessage('Sign-in is unavailable. Please try again.'); });
      const { data } = client.auth.onAuthStateChange((_event, session) => { if (active) setSignedIn(!!session); });
      return () => { active = false; data.subscription.unsubscribe(); };
    } catch { setAvailable(false); setMessage('Sign-in configuration is unavailable. You can still train locally.'); }
  }, []);
  async function signIn() {
    if (!validEmail(email)) { setMessage('Enter a valid email address.'); return; }
    if (!password) { setMessage('Enter your password.'); return; }
    setBusy(true); setMessage('');
    try {
      const client = getSupabase();
      if (!client) { setAvailable(false); return; }
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      setSignedIn(true); setMessage('You’re signed in. Your training is ready.');
    } catch { setMessage('Could not sign in. Check your email and password and try again.'); }
    finally { setBusy(false); }
  }
  async function signUp() {
    if (!validEmail(email)) { setMessage('Enter a valid email address.'); return; }
    if (password.length < 8) { setMessage('Password must be at least 8 characters.'); return; }
    setBusy(true); setMessage('');
    try {
      const client = getSupabase();
      if (!client) { setAvailable(false); return; }
      const { data, error } = await client.auth.signUp({ email: email.trim(), password });
      if (error) throw error;
      setSignedIn(!!data.session); setMessage(data.session ? 'You’re signed in. Your training is ready.' : 'Account created. Check your inbox to confirm your email, then sign in.');
    } catch { setMessage('Could not create your account. Check your details and try again.'); }
    finally { setBusy(false); }
  }
  return <Screen title={signedIn ? 'You’re signed in.' : 'Welcome to the bar.'} eyebrow="YOUR ACCOUNT">
    <Text style={s.muted}>Sign in with your email and password.</Text>
    {!available ? <View style={s.card}><Text style={s.heading}>Train without an account.</Text><Text style={s.muted}>Email sign-in is not configured in this build. Setup, workouts, and history work locally on this device.</Text></View> : signedIn ? <Button title="Sign out" secondary disabled={busy} onPress={async () => { setBusy(true); try { const result = await getSupabase()?.auth.signOut({ scope: 'local' }); if (result?.error) throw result.error; setSignedIn(false); setMessage('Signed out. Local training stays on this device.'); } catch { setMessage('Could not sign out. Try again.'); } finally { setBusy(false); } }} /> : <>
      <Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" placeholder="you@example.com" editable={!busy} />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="password" placeholder="••••••••" editable={!busy} onSubmitEditing={() => { if (!busy) void signIn(); }} />
      <Button title={busy ? 'Please wait…' : 'Sign in'} disabled={busy} onPress={signIn} />
      <Button title={busy ? 'Please wait…' : 'Create account'} secondary disabled={busy} onPress={signUp} />
    </>}
    {!!message && <Message tone={message.startsWith('You’re signed in') || message.startsWith('Signed out') || message.startsWith('Account created') ? 'success' : 'error'}>{message}</Message>}
    <Button title="Continue to training" secondary onPress={() => router.replace('/')} />
    <Text style={s.muted}>Workouts are saved on this device, not synced to your account. People using this browser or device share the same local training.</Text>
  </Screen>;
}
