/**
 * Payout Setup - Complete Screen
 * Shown when onboarding is complete
 */

import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function PayoutCompleteScreen(): React.JSX.Element {
  useEffect(() => {
    // Auto-navigate to payouts screen after 3 seconds
    const timer = setTimeout(() => {
      router.replace("/payouts");
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.replace("/payouts")} 
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <IconSymbol name="chevron.left" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Setup Complete</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <IconSymbol name="checkmark.circle.fill" size={80} color="#34C759" />
        </View>

        <Text style={styles.title}>Setup Complete!</Text>
        <Text style={styles.subtitle}>
          Your payout account has been successfully set up. You can now receive weekly payouts from your ride earnings.
        </Text>

        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <IconSymbol name="checkmark.circle.fill" size={24} color="#34C759" />
            <Text style={styles.infoText}>Account verified</Text>
          </View>
          <View style={styles.infoItem}>
            <IconSymbol name="checkmark.circle.fill" size={24} color="#34C759" />
            <Text style={styles.infoText}>Bank account linked</Text>
          </View>
          <View style={styles.infoItem}>
            <IconSymbol name="checkmark.circle.fill" size={24} color="#34C759" />
            <Text style={styles.infoText}>Ready for payouts</Text>
          </View>
        </View>

        <View style={styles.noteBox}>
          <IconSymbol name="info.circle.fill" size={20} color="#4285F4" />
          <Text style={styles.noteText}>
            Payouts are processed automatically every week. You'll receive a notification when your payout is sent.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace("/payouts")}
        >
          <Text style={styles.buttonText}>Go to Payouts</Text>
          <IconSymbol name="arrow.right" size={20} color="#FFFFFF" />
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
  content: {
    padding: 24,
    paddingTop: 16,
    alignItems: "center",
  },
  iconContainer: {
    marginTop: 48,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1A1A1A",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666666",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  infoSection: {
    width: "100%",
    gap: 16,
    marginBottom: 32,
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
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#E8F0FE",
    borderRadius: 8,
    padding: 12,
    marginBottom: 32,
    gap: 12,
    width: "100%",
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    color: "#4285F4",
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#4285F4",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minWidth: 200,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

