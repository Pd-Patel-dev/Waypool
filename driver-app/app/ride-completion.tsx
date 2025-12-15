import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function RideCompletionScreen(): React.JSX.Element {
  const params = useLocalSearchParams();
  const totalEarnings = params.totalEarnings
    ? parseFloat(params.totalEarnings as string)
    : 0;
  const rideId = params.rideId ? parseInt(params.rideId as string) : null;

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar style="light" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.successIcon}>
            <IconSymbol size={64} name="checkmark.circle.fill" color="#34C759" />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Ride Completed!</Text>
        <Text style={styles.subtitle}>
          Thank you for completing the ride. All passengers have been notified.
        </Text>

        {/* Earnings Card */}
        <View style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>Total Earnings</Text>
          <Text style={styles.earningsAmount}>${totalEarnings.toFixed(2)}</Text>
          <View style={styles.earningsBreakdown}>
            <Text style={styles.earningsBreakdownText}>
              This amount has been recorded for this ride.
            </Text>
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <IconSymbol size={20} name="info.circle" color="#4285F4" />
            <Text style={styles.infoText}>
              You can view this ride and earnings in the "Past Rides" section.
            </Text>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => {
            // Navigate back to home screen
            router.replace("/(tabs)");
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(52, 199, 89, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "400",
    color: "#999999",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  earningsCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  earningsLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#999999",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  earningsAmount: {
    fontSize: 48,
    fontWeight: "700",
    color: "#34C759",
    marginBottom: 12,
    letterSpacing: -1,
  },
  earningsBreakdown: {
    marginTop: 8,
  },
  earningsBreakdownText: {
    fontSize: 12,
    fontWeight: "400",
    color: "#666666",
    textAlign: "center",
  },
  infoCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "400",
    color: "#CCCCCC",
    lineHeight: 20,
  },
  doneButton: {
    backgroundColor: "#4285F4",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
});

