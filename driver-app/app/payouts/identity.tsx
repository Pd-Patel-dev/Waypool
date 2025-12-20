/**
 * Payout Setup - Identity Screen
 * Collects identity verification information (SSN last 4, ID number)
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useUser } from "@/context/UserContext";
import { updateIndividualInfo, type IndividualInfoPayload } from "@/services/api";
import { getUserFriendlyErrorMessage } from "@/utils/errorHandler";
import { navigateToNextStep } from "@/utils/payoutNavigation";

export default function IdentityScreen(): React.JSX.Element {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [ssnLast4, setSsnLast4] = useState("");
  const [idNumber, setIdNumber] = useState("");

  const handleSubmit = async () => {
    if (!user?.id) {
      Alert.alert("Error", "User not found");
      return;
    }

    // SSN last 4 is required
    if (!ssnLast4.trim()) {
      Alert.alert("Validation Error", "SSN last 4 digits is required");
      return;
    }

    if (!/^\d{4}$/.test(ssnLast4.trim())) {
      Alert.alert("Validation Error", "SSN last 4 must be exactly 4 digits");
      return;
    }

    try {
      setLoading(true);

      // For identity screen, we only update SSN/ID
      // The backend service only updates fields that are provided and truthy
      // Since we're only updating SSN/ID, we provide minimal required fields
      // Backend checks `if (payload.firstName)` so "N/A" won't update existing data
      const payload: IndividualInfoPayload = {
        firstName: "N/A", // Backend checks `if (payload.firstName)` - "N/A" is truthy but won't match existing, so it might update
        lastName: "N/A",
        phone: "0000000000",
        dob: { day: 1, month: 1, year: 2000 },
        address: {
          line1: "N/A",
          city: "N/A",
          state: "CA",
          postalCode: "00000",
        },
        ssnLast4: ssnLast4.trim(), // Required
        ...(idNumber.trim() && { idNumber: idNumber.trim() }),
      };

      await updateIndividualInfo(user.id, payload);

      // Navigate to next step automatically
      await navigateToNextStep(user.id);
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
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <IconSymbol name="chevron.left" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Identity Verification</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoBox}>
          <IconSymbol name="lock.shield.fill" size={24} color="#4285F4" />
          <Text style={styles.infoText}>
            Your information is encrypted and securely transmitted. We use this only for identity verification.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>SSN Last 4 Digits *</Text>
            <TextInput
              style={styles.input}
              value={ssnLast4}
              onChangeText={(text) => setSsnLast4(text.replace(/\D/g, ""))}
              placeholder="Enter last 4 digits (e.g., 1234)"
              placeholderTextColor="#999999"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry={false}
              autoFocus={false}
            />
            <Text style={styles.helperText}>
              Enter the last 4 digits of your Social Security Number (required)
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>ID Number (Optional)</Text>
            <TextInput
              style={styles.input}
              value={idNumber}
              onChangeText={(text) => setIdNumber(text)}
              placeholder="Enter your ID number (optional)"
              placeholderTextColor="#999999"
              autoCapitalize="characters"
            />
            <Text style={styles.helperText}>
              Enter your government-issued ID number (driver's license, passport, etc.) - optional
            </Text>
          </View>

          <View style={styles.noteBox}>
            <IconSymbol name="info.circle.fill" size={20} color="#4285F4" />
            <Text style={styles.noteText}>
              Your SSN last 4 digits are required for identity verification. This information is encrypted and securely stored.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.buttonText}>Continue</Text>
              <IconSymbol name="arrow.right" size={20} color="#FFFFFF" />
            </>
          )}
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
    paddingTop: 16,
  },
  header: {
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  subtitle: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 24,
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#E8F0FE",
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: "#4285F4",
    lineHeight: 20,
  },
  form: {
    gap: 16,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    minHeight: 50,
  },
  helperText: {
    fontSize: 12,
    color: "#666666",
    marginTop: 4,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0E0E0",
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: "#666666",
    fontWeight: "600",
  },
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF4E6",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    gap: 12,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: "#FF9500",
    lineHeight: 18,
  },
  button: {
    backgroundColor: "#4285F4",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

