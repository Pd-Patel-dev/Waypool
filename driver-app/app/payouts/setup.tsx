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
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useUser } from "@/context/UserContext";
import { createCustomConnectAccount, getConnectRequirements, clearBusinessProfile } from "@/services/api";
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

      // Get requirements to find the first incomplete step
      const requirements = await getConnectRequirements(user.id);
      
      // Clear business_profile if needed
      if (
        (requirements.currentlyDue || []).some((req: string) => req.includes("business_profile")) ||
        (requirements.pastDue || []).some((req: string) => req.includes("business_profile"))
      ) {
        await clearBusinessProfile(user.id);
      }

      // If payouts are enabled, go to complete screen
      if (requirements.payoutsEnabled) {
        router.replace("/payouts/complete");
        return;
      }

      // Find the first incomplete step and go directly to it
      const steps = [
        {
          id: "personal-info",
          route: "/payouts/personal-info",
          requirements: [
            "individual.first_name",
            "individual.last_name",
            "individual.dob",
            "individual.phone",
            "individual.address.line1",
            "individual.address.city",
            "individual.address.state",
            "individual.address.postal_code",
          ],
        },
        {
          id: "identity",
          route: "/payouts/identity",
          requirements: ["individual.ssn_last_4", "individual.id_number"],
        },
        {
          id: "bank-account",
          route: "/payouts/bank-account",
          requirements: ["external_account"],
        },
        {
          id: "documents",
          route: "/payouts/document-upload",
          requirements: [
            "individual.verification.document",
            "individual.verification.document.front",
            "individual.verification.document.back",
          ],
        },
      ];

      const allDue = [
        ...(requirements.currentlyDue || []),
        ...(requirements.pastDue || []),
      ].filter((req: string) => !req.includes("business_profile"));

      // Helper to check if requirement matches
      const requirementMatches = (stepReq: string, dueReq: string): boolean => {
        const stepNorm = stepReq.toLowerCase();
        const dueNorm = dueReq.toLowerCase();
        return dueNorm.includes(stepNorm) || stepNorm.includes(dueNorm.split(".")[0]);
      };

      // Helper to check if a step is complete
      const isStepComplete = (step: typeof steps[0]): boolean => {
        const hasRequirement = step.requirements.some((stepReq) =>
          allDue.some((dueReq) => requirementMatches(stepReq, dueReq))
        );
        return !hasRequirement; // Step is complete if none of its requirements are due
      };

      // Go through steps in order - always show them sequentially
      // Step 1: Personal Info
      const personalInfoComplete = isStepComplete(steps[0]);
      if (!personalInfoComplete) {
        router.replace(steps[0].route as any);
        return;
      }

      // Step 2: Identity (ALWAYS show after personal info in initial setup, regardless of Stripe requirements)
      // Stripe may not require SSN immediately (especially in test mode), but we always collect it
      // This is the initial setup flow, so we always show identity after personal info
      router.replace(steps[1].route as any);
      return;
    } catch (error) {
      Alert.alert("Error", getUserFriendlyErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.navHeader}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <IconSymbol name="chevron.left" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.navHeaderTitle}>Setup Payouts</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {testMode && (
          <View style={styles.testBanner}>
            <Text style={styles.testBannerText}>🧪 TEST MODE</Text>
          </View>
        )}

        <View style={styles.header}>
          <IconSymbol name="dollarsign.circle.fill" size={56} color="#4285F4" />
          <Text style={styles.title}>Link Your Bank Account</Text>
          <Text style={styles.subtitle}>
            Receive weekly payments directly to your bank account
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
          style={styles.cancelButton}
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
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  navHeaderTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A1A",
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
    fontSize: 24,
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
    lineHeight: 22,
    marginTop: 8,
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
  cancelButton: {
    padding: 16,
    alignItems: "center",
  },
  backButtonText: {
    color: "#666666",
    fontSize: 16,
  },
});
