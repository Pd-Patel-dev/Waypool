import { DarkTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { UserProvider } from '@/context/UserContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { RealtimeProvider } from '@/context/RealtimeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <UserProvider>
        <NotificationProvider>
          <RealtimeProvider>
            <NavigationThemeProvider value={DarkTheme}>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ headerShown: false, presentation: 'card' }} />
                <Stack.Screen name="signup" options={{ headerShown: false, presentation: 'card' }} />
                <Stack.Screen name="verify-email" options={{ headerShown: false, presentation: 'card' }} />
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
                <Stack.Screen name="payouts" options={{ headerShown: false, presentation: 'card' }} />
                <Stack.Screen name="payout-onboarding" options={{ headerShown: false, presentation: 'card' }} />
                <Stack.Screen name="payout-history" options={{ headerShown: false, presentation: 'card' }} />
                <Stack.Screen name="onboarding/complete" options={{ headerShown: false, presentation: 'card' }} />
              </Stack>
              <StatusBar style="light" />
            </NavigationThemeProvider>
          </RealtimeProvider>
        </NotificationProvider>
      </UserProvider>
    </ErrorBoundary>
  );
}
