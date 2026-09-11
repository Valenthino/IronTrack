import { useState } from 'react';
import { useTraining } from '../state/store';
import { saveNote } from '../training/progress';
import { Button, Field, Message } from './common';
export function SessionNotes({ id, initial = '' }: { id: string; initial?: string }) {
  const { saving, update } = useTraining();
  const [notes, setNotes] = useState(initial);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  return <><Field label="Session notes (optional)" multiline maxLength={2000} value={notes} onChangeText={value => { setNotes(value); setMessage(''); }} placeholder="How did it feel? Anything to remember?" />
    <Button title="Save notes" secondary disabled={saving} onPress={async () => { try { await update(data => saveNote(data, id, notes)); setFailed(false); setMessage('Notes saved on this device.'); } catch { setFailed(true); setMessage('Could not save notes. Please retry.'); } }} />
    {!!message && <Message tone={failed ? 'error' : 'success'}>{message}</Message>}</>;
}
