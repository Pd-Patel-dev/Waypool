/**
 * Payout Setup - Intro Screen
 * Entry point for Stripe Connect Custom account onboarding
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useUser } from "@/context/UserContext";
import { createCustomConnectAccount } from "@/services/api";
import { getUserFriendlyErrorMessage } from "@/utils/errorHandler";

export default function PayoutSetupIntroScreen(): React.JSX.Element {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const testMode = __DEV__; // Show test banner in development

  const handleStartSetup = async () => {
    if (!user?.id) {
      Alert.alert("Error", "User not found");
      return;
    }

    try {
      setLoading(true);

      // Create Custom connected account
      await createCustomConnectAccount(user.id);

      // Navigate to checklist
      router.push("/payouts/checklist");
    } catch (error) {
      Alert.alert("Error", getUserFriendlyErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView contentContainerStyle={styles.content}>
        {testMode && (
          <View style={styles.testBanner}>
            <Text style={styles.testBannerText}>🧪 TEST MODE</Text>
          </View>
        )}

        <View style={styles.header}>
          <IconSymbol name="dollarsign.circle.fill" size={64} color="#4285F4" />
          <Text style={styles.title}>Set Up Weekly Payouts</Text>
          <Text style={styles.subtitle}>
            Complete your payout account setup to receive weekly payments from
            your ride earnings.
          </Text>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <IconSymbol
              name="checkmark.circle.fill"
              size={24}
              color="#34C759"
            />
            <Text style={styles.infoText}>Secure bank account linking</Text>
          </View>
          <View style={styles.infoItem}>
            <IconSymbol
              name="checkmark.circle.fill"
              size={24}
              color="#34C759"
            />
            <Text style={styles.infoText}>Automatic weekly payouts</Text>
          </View>
          <View style={styles.infoItem}>
            <IconSymbol
              name="checkmark.circle.fill"
              size={24}
              color="#34C759"
            />
            <Text style={styles.infoText}>Protected by Stripe</Text>
          </View>
        </View>

        <View style={styles.requirementsSection}>
          <Text style={styles.requirementsTitle}>You'll need to provide:</Text>
          <Text style={styles.requirementsText}>• Personal information</Text>
          <Text style={styles.requirementsText}>• Bank account details</Text>
          <Text style={styles.requirementsText}>
            • Identity verification (if required)
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleStartSetup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.buttonText}>Start Setup</Text>
              <IconSymbol name="arrow.right" size={20} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    padding: 24,
  },
  testBanner: {
    backgroundColor: "#FF9500",
    padding: 8,
    borderRadius: 6,
    marginBottom: 16,
    alignItems: "center",
  },
  testBannerText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 12,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1A1A1A",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666666",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  infoSection: {
    marginBottom: 32,
    gap: 16,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoText: {
    fontSize: 16,
    color: "#1A1A1A",
  },
  requirementsSection: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 16,
    marginBottom: 32,
  },
  requirementsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  requirementsText: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 4,
  },
  button: {
    backgroundColor: "#4285F4",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  backButton: {
    padding: 16,
    alignItems: "center",
  },
  backButtonText: {
    color: "#666666",
    fontSize: 16,
  },
});
