/**
 * Payout Setup - Bank Account Screen
 * Collects bank account information for payouts
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
import {
  createConnectBankAccountToken,
  attachBankAccount,
} from "@/services/api";
import { getUserFriendlyErrorMessage } from "@/utils/errorHandler";
import { navigateToNextStep } from "@/utils/payoutNavigation";

export default function BankAccountScreen(): React.JSX.Element {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    routingNumber: "",
    accountNumber: "",
    accountHolderName: "",
  });

  const handleSubmit = async () => {
    if (!user?.id) {
      Alert.alert("Error", "User not found");
      return;
    }

    // Validation
    if (!formData.routingNumber.trim()) {
      Alert.alert("Validation Error", "Routing number is required");
      return;
    }
    if (!/^\d{9}$/.test(formData.routingNumber.trim())) {
      Alert.alert("Validation Error", "Routing number must be exactly 9 digits");
      return;
    }
    if (!formData.accountNumber.trim()) {
      Alert.alert("Validation Error", "Account number is required");
      return;
    }
    if (formData.accountNumber.trim().length < 4) {
      Alert.alert("Validation Error", "Account number must be at least 4 digits");
      return;
    }
    if (!formData.accountHolderName.trim()) {
      Alert.alert("Validation Error", "Account holder name is required");
      return;
    }

    try {
      setLoading(true);

      // Create bank account token
      const { tokenId } = await createConnectBankAccountToken(user.id, {
        routingNumber: formData.routingNumber.trim(),
        accountNumber: formData.accountNumber.trim(),
        accountHolderName: formData.accountHolderName.trim(),
      });

      // Attach bank account to connected account
      await attachBankAccount(user.id, tokenId);

      // Always navigate to document upload screen after bank account
      // This ensures we collect identity documents even if Stripe doesn't require them yet
      router.replace("/payouts/document-upload");
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
        <Text style={styles.headerTitle}>Bank Account</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoBox}>
          <IconSymbol name="lock.shield.fill" size={24} color="#4285F4" />
          <Text style={styles.infoText}>
            Your bank account information is encrypted and securely stored. We never store your full account number.
          </Text>
        </View>

        {__DEV__ && (
          <View style={styles.testBox}>
            <IconSymbol name="info.circle.fill" size={20} color="#FF9500" />
            <Text style={styles.testText}>
              Test Mode: Use routing number{" "}
              <Text style={styles.testBold}>110000000</Text> for testing
            </Text>
          </View>
        )}

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Routing Number *</Text>
            <TextInput
              style={styles.input}
              value={formData.routingNumber}
              onChangeText={(text) => setFormData({ ...formData, routingNumber: text.replace(/\D/g, "") })}
              placeholder="110000000"
              keyboardType="number-pad"
              maxLength={9}
            />
            <Text style={styles.helperText}>
              Enter your 9-digit bank routing number
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Account Number *</Text>
            <TextInput
              style={styles.input}
              value={formData.accountNumber}
              onChangeText={(text) => setFormData({ ...formData, accountNumber: text.replace(/\D/g, "") })}
              placeholder="000123456789"
              keyboardType="number-pad"
              secureTextEntry
            />
            <Text style={styles.helperText}>
              Enter your bank account number
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Account Holder Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.accountHolderName}
              onChangeText={(text) => setFormData({ ...formData, accountHolderName: text })}
              placeholder="John Doe"
              autoCapitalize="words"
            />
            <Text style={styles.helperText}>
              Name as it appears on your bank account
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
              <Text style={styles.buttonText}>Link Bank Account</Text>
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
    marginBottom: 16,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: "#4285F4",
    lineHeight: 20,
  },
  testBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF4E6",
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    gap: 12,
  },
  testText: {
    flex: 1,
    fontSize: 12,
    color: "#FF9500",
    lineHeight: 18,
  },
  testBold: {
    fontWeight: "600",
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
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  helperText: {
    fontSize: 12,
    color: "#666666",
    marginTop: 4,
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

