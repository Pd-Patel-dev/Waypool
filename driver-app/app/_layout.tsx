import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { UserProvider } from '@/context/UserContext';
import { NotificationProvider } from '@/context/NotificationContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <UserProvider>
      <NotificationProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="signup" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="add-ride" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="current-ride" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="booking-request" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="past-rides" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="past-ride-details" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="upcoming-ride-details" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="ride-completion" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="edit-ride" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="profile" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="vehicle" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="help-support" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="settings" options={{ headerShown: false, presentation: 'card' }} />
            <Stack.Screen name="booking-history" options={{ headerShown: false, presentation: 'card' }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </NotificationProvider>
    </UserProvider>
  );
}
