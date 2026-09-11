import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { initialData, restoreData, type AppData } from '../training/flows';
// Keep the original key so restoreData can migrate existing v1 installations.
const KEY = 'irontrack.training.v1';
type Store = { data: AppData; ready: boolean; saving: boolean; error: string; update: (change: (data: AppData) => AppData) => Promise<void> };
const Context = createContext<Store | null>(null);
export function TrainingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(initialData);
  const current = useRef(data);
  const lock = useRef(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; AsyncStorage.getItem(KEY).then(raw => {
    const restored = raw ? restoreData(raw) : initialData();
    if (active) { current.current = restored; setData(restored); setReady(true); }
  }).catch(() => { if (active) setError('Could not load saved training. Reload to retry; saved data has not been overwritten.'); }); return () => { active = false; }; }, []);
  async function update(change: (data: AppData) => AppData) {
    if (!ready || lock.current) throw new Error('Please wait for training to finish saving.');
    lock.current = true; setSaving(true); setError('');
    try {
      const next = change(current.current);
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
      current.current = next; setData(next);
    } catch (err) { setError('Changes could not be saved. Please try again.'); throw err; }
    finally { lock.current = false; setSaving(false); }
  }
  return <Context.Provider value={{ data, ready, saving, error, update }}>{children}</Context.Provider>;
}
export function useTraining() { const value = useContext(Context); if (!value) throw new Error('Training provider missing'); return value; }
