/**
 * Payout Setup - Personal Info Screen
 * Collects personal information for Stripe Connect onboarding
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

export default function PersonalInfoScreen(): React.JSX.Element {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: user?.phoneNumber || "",
    dobDay: "",
    dobMonth: "",
    dobYear: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
  });

  const handleSubmit = async () => {
    if (!user?.id) {
      Alert.alert("Error", "User not found");
      return;
    }

    // Validation
    if (!formData.firstName.trim()) {
      Alert.alert("Validation Error", "First name is required");
      return;
    }
    if (!formData.lastName.trim()) {
      Alert.alert("Validation Error", "Last name is required");
      return;
    }
    if (!formData.phone.trim()) {
      Alert.alert("Validation Error", "Phone number is required");
      return;
    }
    if (!formData.dobDay || !formData.dobMonth || !formData.dobYear) {
      Alert.alert("Validation Error", "Date of birth is required");
      return;
    }
    if (!formData.addressLine1.trim()) {
      Alert.alert("Validation Error", "Address is required");
      return;
    }
    if (!formData.city.trim()) {
      Alert.alert("Validation Error", "City is required");
      return;
    }
    if (!formData.state.trim()) {
      Alert.alert("Validation Error", "State is required");
      return;
    }
    if (!formData.postalCode.trim()) {
      Alert.alert("Validation Error", "ZIP code is required");
      return;
    }

    const day = parseInt(formData.dobDay, 10);
    const month = parseInt(formData.dobMonth, 10);
    const year = parseInt(formData.dobYear, 10);

    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > new Date().getFullYear()) {
      Alert.alert("Validation Error", "Please enter a valid date of birth");
      return;
    }

    try {
      setLoading(true);

      const payload: IndividualInfoPayload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim(),
        dob: {
          day,
          month,
          year,
        },
        address: {
          line1: formData.addressLine1.trim(),
          line2: formData.addressLine2.trim() || undefined,
          city: formData.city.trim(),
          state: formData.state.trim(),
          postalCode: formData.postalCode.trim(),
        },
      };

      await updateIndividualInfo(user.id, payload);

      // Always navigate to identity screen after personal info
      // This ensures we collect SSN even if Stripe doesn't require it yet
      router.replace("/payouts/identity");
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
        <Text style={styles.headerTitle}>Personal Information</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.form}>
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>First Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.firstName}
                onChangeText={(text) => setFormData({ ...formData, firstName: text })}
                placeholder="John"
                autoCapitalize="words"
              />
            </View>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Last Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.lastName}
                onChangeText={(text) => setFormData({ ...formData, lastName: text })}
                placeholder="Doe"
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number *</Text>
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              placeholder="+1234567890"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date of Birth *</Text>
            <View style={styles.dobRow}>
              <TextInput
                style={[styles.input, styles.dobInput]}
                value={formData.dobMonth}
                onChangeText={(text) => setFormData({ ...formData, dobMonth: text })}
                placeholder="MM"
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.dobSeparator}>/</Text>
              <TextInput
                style={[styles.input, styles.dobInput]}
                value={formData.dobDay}
                onChangeText={(text) => setFormData({ ...formData, dobDay: text })}
                placeholder="DD"
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.dobSeparator}>/</Text>
              <TextInput
                style={[styles.input, styles.dobInput, styles.dobYear]}
                value={formData.dobYear}
                onChangeText={(text) => setFormData({ ...formData, dobYear: text })}
                placeholder="YYYY"
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address Line 1 *</Text>
            <TextInput
              style={styles.input}
              value={formData.addressLine1}
              onChangeText={(text) => setFormData({ ...formData, addressLine1: text })}
              placeholder="123 Main St"
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address Line 2 (Optional)</Text>
            <TextInput
              style={styles.input}
              value={formData.addressLine2}
              onChangeText={(text) => setFormData({ ...formData, addressLine2: text })}
              placeholder="Apt 4B"
              autoCapitalize="words"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>City *</Text>
              <TextInput
                style={styles.input}
                value={formData.city}
                onChangeText={(text) => setFormData({ ...formData, city: text })}
                placeholder="New York"
                autoCapitalize="words"
              />
            </View>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>State *</Text>
              <TextInput
                style={styles.input}
                value={formData.state}
                onChangeText={(text) => setFormData({ ...formData, state: text.toUpperCase() })}
                placeholder="NY"
                autoCapitalize="characters"
                maxLength={2}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>ZIP Code *</Text>
            <TextInput
              style={styles.input}
              value={formData.postalCode}
              onChangeText={(text) => setFormData({ ...formData, postalCode: text })}
              placeholder="10001"
              keyboardType="number-pad"
              maxLength={10}
            />
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
  },
  form: {
    gap: 16,
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  inputGroup: {
    flex: 1,
  },
  halfWidth: {
    flex: 1,
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
  dobRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dobInput: {
    flex: 1,
    textAlign: "center",
  },
  dobYear: {
    flex: 1.5,
  },
  dobSeparator: {
    fontSize: 18,
    color: "#666666",
    fontWeight: "600",
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

