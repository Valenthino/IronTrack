import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TrainingProvider } from '../src/state/store';
import { theme } from '../src/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TrainingProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }} />
      </TrainingProvider>
    </SafeAreaProvider>
  );
}
