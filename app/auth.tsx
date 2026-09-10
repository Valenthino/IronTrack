import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Platform, Text, View } from 'react-native';
import { getSupabase, isSupabaseConfigured } from '../src/lib/supabase';
import { validEmail } from '../src/training/flows';
import { Button, Field, Message, Screen, s } from '../src/ui/common';

export default function Auth() {
  const router = useRouter();
  const url = Linking.useURL();
  const handled = useRef<string | null>(null);
  const [email, setEmail] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [available, setAvailable] = useState(isSupabaseConfigured);
  useEffect(() => {
    try {
      const client = getSupabase();
      if (!client) return;
      let active = true;
      client.auth.getSession().then(({ data, error }) => { if (active) { setSignedIn(!!data.session); if (error) setMessage('Unable to restore your sign-in. Please request a new link.'); } }).catch(() => { if (active) setMessage('Sign-in is unavailable. Please try again.'); });
      const { data } = client.auth.onAuthStateChange((_event, session) => { if (active) setSignedIn(!!session); });
      return () => { active = false; data.subscription.unsubscribe(); };
    } catch { setAvailable(false); setMessage('Sign-in configuration is unavailable. You can still train locally.'); }
  }, []);
  useEffect(() => {
    if (!url || handled.current === url) return;
    let parsed: URL;
    try { parsed = new URL(url); } catch { setMessage('This sign-in link is invalid. Request a new one.'); return; }
    const params = new URLSearchParams(parsed.hash.slice(1));
    const code = parsed.searchParams.get('code');
    const access = params.get('access_token');
    const refresh = params.get('refresh_token');
    const failed = params.has('error') || parsed.searchParams.has('error');
    if (!code && !access && !refresh && !failed) return;
    handled.current = url;
    // Remove callback credentials from the address bar; never display or log them.
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.history.replaceState({}, '', '/auth');
    if (failed || (!code && (!access || !refresh))) { setMessage('This sign-in link is invalid or expired. Request a new one.'); return; }
    setBusy(true);
    (async () => {
      try {
        const client = getSupabase();
        if (!client) throw new Error('Unavailable');
        const result = code ? await client.auth.exchangeCodeForSession(code) : await client.auth.setSession({ access_token: access!, refresh_token: refresh! });
        if (result.error) throw result.error;
        setSignedIn(!!result.data.session); setMessage('You’re signed in. Your training is ready.');
      } catch { setMessage('Could not complete sign-in. Request a new link and try again.'); }
      finally { setBusy(false); }
    })();
  }, [url]);
  async function sendLink() {
    if (!validEmail(email)) { setMessage('Enter a valid email address.'); return; }
    setBusy(true); setMessage('');
    try {
      const client = getSupabase();
      if (!client) { setAvailable(false); return; }
      const redirect = Platform.OS === 'web' ? `${window.location.origin}/auth` : Linking.createURL('auth');
      const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirect } });
      if (error) throw error;
      setMessage('Check your inbox for a sign-in link. Open it on this device to continue.');
    } catch { setMessage('Could not send your link. Check your connection and try again shortly.'); }
    finally { setBusy(false); }
  }
  return <Screen title={signedIn ? 'You’re signed in.' : 'Welcome to the bar.'} eyebrow="YOUR ACCOUNT">
    <Text style={s.muted}>A sign-in link, sent to your email. No password to remember.</Text>
    {!available ? <View style={s.card}><Text style={s.heading}>Train without an account.</Text><Text style={s.muted}>Email sign-in is not configured in this build. Setup, workouts, and history work locally on this device.</Text></View> : signedIn ? <Button title="Sign out" secondary disabled={busy} onPress={async () => { setBusy(true); try { const result = await getSupabase()?.auth.signOut({ scope: 'local' }); if (result?.error) throw result.error; setSignedIn(false); setMessage('Signed out. Local training stays on this device.'); } catch { setMessage('Could not sign out. Try again.'); } finally { setBusy(false); } }} /> : <><Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" placeholder="you@example.com" editable={!busy} onSubmitEditing={() => { if (!busy) void sendLink(); }} /><Button title={busy ? 'Please wait…' : 'Send magic link'} disabled={busy} onPress={sendLink} /></>}
    {!!message && <Message tone={message.startsWith('You’re signed in') || message.startsWith('Signed out') || message.startsWith('Check your inbox') ? 'success' : 'error'}>{message}</Message>}
    <Button title="Continue to training" secondary onPress={() => router.replace('/')} />
    <Text style={s.muted}>Workouts are saved on this device, not synced to your account. People using this browser or device share the same local training.</Text>
  </Screen>;
}
