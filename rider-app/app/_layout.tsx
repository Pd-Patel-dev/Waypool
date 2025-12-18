import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { StripeProvider } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { UserProvider } from '@/context/UserContext';

export const unstable_settings = {
  initialRouteName: 'welcome',
};

// Get Stripe publishable key from environment variables
// For Expo, env vars must be prefixed with EXPO_PUBLIC_ to be accessible in client code
// The .env file should have: EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_key_here
// We check multiple sources to ensure the key is loaded

// Try multiple ways to get the Stripe key from environment
const getStripeKey = () => {
  // Method 1: Check process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY (primary method for Expo)
  if (process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    console.log('✅ Found key in process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY');
    return process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  }
  
  // Method 2: Check process.env.EXPO_STRIPE_PUBLISHABLE_KEY (fallback)
  if (process.env.EXPO_STRIPE_PUBLISHABLE_KEY) {
    console.log('✅ Found key in process.env.EXPO_STRIPE_PUBLISHABLE_KEY');
    return process.env.EXPO_STRIPE_PUBLISHABLE_KEY;
  }
  
  // Method 3: Check Constants.expoConfig.extra (for app.config.js)
  if (Constants.expoConfig?.extra?.stripePublishableKey) {
    console.log('✅ Found key in Constants.expoConfig.extra.stripePublishableKey');
    return Constants.expoConfig.extra.stripePublishableKey;
  }
  
  // Method 4: Check Constants.manifest?.extra (for older Expo versions)
  if (Constants.manifest?.extra?.stripePublishableKey) {
    console.log('✅ Found key in Constants.manifest.extra.stripePublishableKey');
    return Constants.manifest.extra.stripePublishableKey;
  }
  
  // Method 5: Check EXPO_STRIPE_PUBLISHABLE_KEY from Constants
  if (Constants.expoConfig?.extra?.EXPO_STRIPE_PUBLISHABLE_KEY) {
    console.log('✅ Found key in Constants.expoConfig.extra.EXPO_STRIPE_PUBLISHABLE_KEY');
    return Constants.expoConfig.extra.EXPO_STRIPE_PUBLISHABLE_KEY;
  }
  
  console.warn('⚠️  Stripe key not found in any environment source');
  return 'pk_test_placeholder';
};

const STRIPE_PUBLISHABLE_KEY = getStripeKey();

// Log Stripe key status (first 10 chars only for security)
if (STRIPE_PUBLISHABLE_KEY && STRIPE_PUBLISHABLE_KEY !== 'pk_test_placeholder') {
  console.log('✅ Stripe publishable key loaded:', STRIPE_PUBLISHABLE_KEY.substring(0, 10) + '...');
  if (!STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_') && !STRIPE_PUBLISHABLE_KEY.startsWith('pk_live_')) {
    console.warn('⚠️  Warning: Stripe key format may be incorrect. Should start with pk_test_ or pk_live_');
  }
} else {
  console.error('❌ Stripe publishable key not found or using placeholder!');
}

export default function RootLayout() {
  // Only initialize StripeProvider if we have a valid key
  const stripeKey = STRIPE_PUBLISHABLE_KEY && STRIPE_PUBLISHABLE_KEY !== 'pk_test_placeholder' 
    ? STRIPE_PUBLISHABLE_KEY 
    : undefined;

  return (
    <UserProvider>
      {stripeKey ? (
        <StripeProvider
          publishableKey={stripeKey}
          merchantIdentifier="merchant.com.waypool" // Required for Apple Pay
        >
          <ThemeProvider value={DarkTheme}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#000000' },
              }}
            >
              <Stack.Screen name="welcome" />
              <Stack.Screen name="login" options={{ presentation: 'card' }} />
              <Stack.Screen name="signup" options={{ presentation: 'card' }} />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="ride-details" options={{ presentation: 'card', headerShown: false }} />
              <Stack.Screen name="booking" options={{ presentation: 'card', headerShown: false }} />
              <Stack.Screen name="booking-confirm" options={{ presentation: 'card', headerShown: false }} />
              <Stack.Screen name="payment" options={{ presentation: 'card', headerShown: false }} />
              <Stack.Screen name="payment-methods" options={{ presentation: 'card', headerShown: false }} />
              <Stack.Screen name="add-card" options={{ presentation: 'card', headerShown: false }} />
              <Stack.Screen name="booking-details" options={{ presentation: 'card', headerShown: false }} />
              <Stack.Screen name="track-driver" options={{ presentation: 'card', headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
            <StatusBar style="light" />
          </ThemeProvider>
        </StripeProvider>
      ) : (
      <ThemeProvider value={DarkTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#000000' },
          }}
        >
          <Stack.Screen name="welcome" />
          <Stack.Screen name="login" options={{ presentation: 'card' }} />
          <Stack.Screen name="signup" options={{ presentation: 'card' }} />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="ride-details" options={{ presentation: 'card', headerShown: false }} />
          <Stack.Screen name="booking" options={{ presentation: 'card', headerShown: false }} />
            <Stack.Screen name="booking-confirm" options={{ presentation: 'card', headerShown: false }} />
            <Stack.Screen name="payment" options={{ presentation: 'card', headerShown: false }} />
            <Stack.Screen name="payment-methods" options={{ presentation: 'card', headerShown: false }} />
            <Stack.Screen name="add-card" options={{ presentation: 'card', headerShown: false }} />
          <Stack.Screen name="booking-details" options={{ presentation: 'card', headerShown: false }} />
          <Stack.Screen name="track-driver" options={{ presentation: 'card', headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
      )}
    </UserProvider>
  );
}
