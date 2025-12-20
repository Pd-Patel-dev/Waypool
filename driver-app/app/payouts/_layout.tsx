import { Stack } from "expo-router";

/**
 * Layout for payout setup screens
 * Disables headers for all nested screens since we use custom headers
 */
export default function PayoutsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: "card",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="setup" options={{ headerShown: false }} />
      <Stack.Screen name="personal-info" options={{ headerShown: false }} />
      <Stack.Screen name="identity" options={{ headerShown: false }} />
      <Stack.Screen name="bank-account" options={{ headerShown: false }} />
      <Stack.Screen name="document-upload" options={{ headerShown: false }} />
      <Stack.Screen name="checklist" options={{ headerShown: false }} />
      <Stack.Screen name="complete" options={{ headerShown: false }} />
    </Stack>
  );
}

