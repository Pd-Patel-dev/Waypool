/**
 * Payout Setup - Step-by-Step Wizard
 * Shows one step at a time with Next button navigation
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useFocusEffect } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useUser } from "@/context/UserContext";
import { getConnectRequirements, resetStripeStatus, clearBusinessProfile, type ConnectRequirements } from "@/services/api";
import { getUserFriendlyErrorMessage } from "@/utils/errorHandler";

interface Step {
  id: string;
  title: string;
  description: string;
  route: string;
  icon: string;
  requirements: string[];
  completed: boolean;
}

export default function PayoutChecklistScreen(): React.JSX.Element {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [requirements, setRequirements] = useState<ConnectRequirements | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const testMode = __DEV__;

  useEffect(() => {
    loadRequirements();
  }, [user?.id]);

  // Refresh requirements when screen comes into focus (e.g., after completing a step)
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        loadRequirements();
      }
    }, [user?.id])
  );

  const loadRequirements = async (showLoading = true) => {
    if (!user?.id) return;

    try {
      if (showLoading) setLoading(true);
      const data = await getConnectRequirements(user.id);
      
      // Check if there are business_profile requirements for individual accounts
      // If so, automatically clear them
      const hasBusinessProfileRequirements = 
        (data.currentlyDue || []).some((req: string) => req.includes("business_profile")) ||
        (data.pastDue || []).some((req: string) => req.includes("business_profile")) ||
        (data.eventuallyDue || []).some((req: string) => req.includes("business_profile"));
      
      if (hasBusinessProfileRequirements) {
        console.log("[Onboarding] Detected business_profile requirements for individual account. Clearing...");
        try {
          // Clear business_profile requirements
          const clearedData = await clearBusinessProfile(user.id);
          setRequirements(clearedData);
          
          // If payouts are enabled after clearing, navigate to complete screen
          if (clearedData.payoutsEnabled) {
            router.replace("/payouts/complete");
          }
        } catch (clearError) {
          console.warn("[Onboarding] Failed to clear business_profile:", clearError);
          // Continue with original data if clearing fails
          setRequirements(data);
        }
      } else {
        setRequirements(data);
      }

      // If payouts are enabled, navigate to complete screen
      if (data.payoutsEnabled) {
        router.replace("/payouts/complete");
      }
    } catch (error) {
      Alert.alert("Error", getUserFriendlyErrorMessage(error));
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadRequirements(false);
    Alert.alert("Refreshed", "Requirements have been refreshed from Stripe");
  };

  // Helper function to check if a requirement matches
  // Made more strict to avoid false positives
  const requirementMatches = (stepReq: string, dueReq: string): boolean => {
    // Normalize both strings for comparison
    const normalize = (str: string) => str.toLowerCase().trim();
    const stepNorm = normalize(stepReq);
    const dueNorm = normalize(dueReq);
    
    // Exact match
    if (stepNorm === dueNorm) return true;
    
    // For document requirements, be very strict - only exact or very specific matches
    if (stepNorm.includes("verification.document") || stepNorm.includes("document")) {
      // Only match if it's clearly a document requirement
      if (dueNorm.includes("verification.document") || dueNorm.includes("document")) {
        // Check if they match at the document level (front/back are sub-requirements)
        const stepDocBase = stepNorm.split(".").slice(0, 3).join("."); // e.g., "individual.verification.document"
        const dueDocBase = dueNorm.split(".").slice(0, 3).join(".");
        if (stepDocBase === dueDocBase) return true;
        
        // Check for front/back matches
        if (stepNorm.includes("front") && dueNorm.includes("front")) return true;
        if (stepNorm.includes("back") && dueNorm.includes("back")) return true;
      }
      return false; // Don't match document requirements loosely
    }
    
    // For other requirements, check if step requirement is contained in due requirement
    // e.g., "individual.first_name" matches "individual.first_name.required"
    if (dueNorm.includes(stepNorm)) return true;
    
    // Check for partial matches with dot notation (but be more strict)
    const stepParts = stepNorm.split(".");
    const dueParts = dueNorm.split(".");
    
    // Match if all step parts are present in due parts (in order and consecutive)
    if (stepParts.length <= dueParts.length) {
      let stepIndex = 0;
      for (let i = 0; i < dueParts.length && stepIndex < stepParts.length; i++) {
        if (dueParts[i] === stepParts[stepIndex]) {
          stepIndex++;
        }
      }
      // Only match if we found all parts
      if (stepIndex === stepParts.length) return true;
    }
    
    return false;
  };

  // Define onboarding steps in order
  const getSteps = (): Step[] => {
    const currentlyDue = requirements?.currentlyDue || [];
    const pastDue = requirements?.pastDue || [];
    
    // Filter out business_profile requirements for individual accounts
    // These are automatically handled by clearing business_profile
    const filteredCurrentlyDue = currentlyDue.filter(
      (req: string) => !req.includes("business_profile")
    );
    const filteredPastDue = pastDue.filter(
      (req: string) => !req.includes("business_profile")
    );
    
    const allDue = [...new Set([...filteredCurrentlyDue, ...filteredPastDue])];

    const steps: Step[] = [
      {
        id: "personal-info",
        title: "Personal Information",
        description: "Your name, date of birth, phone, and address",
        route: "/payouts/personal-info",
        icon: "person.fill",
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
        completed: false,
      },
      {
        id: "identity",
        title: "Identity Verification",
        description: "SSN or ID number for verification",
        route: "/payouts/identity",
        icon: "lock.shield.fill",
        requirements: ["individual.ssn_last_4", "individual.id_number"],
        completed: false,
      },
      {
        id: "bank-account",
        title: "Bank Account",
        description: "Link your bank account for payouts",
        route: "/payouts/bank-account",
        icon: "building.columns.fill",
        requirements: ["external_account"],
        completed: false,
      },
      {
        id: "documents",
        title: "Identity Documents",
        description: "Upload government-issued ID",
        route: "/payouts/document-upload",
        icon: "doc.text.fill",
        requirements: [
          "individual.verification.document",
          "individual.verification.document.front",
          "individual.verification.document.back",
        ],
        completed: false,
      },
    ];

    // Mark steps as completed or pending based on requirements
    steps.forEach((step) => {
      // For document steps, be extra strict - only mark complete if payouts are enabled
      // This ensures documents are actually verified by Stripe
      if (step.id === "documents") {
        // Check ALL requirement arrays (currentlyDue, pastDue, eventuallyDue) for document requirements
        const currentlyDue = requirements?.currentlyDue || [];
        const pastDue = requirements?.pastDue || [];
        const eventuallyDue = requirements?.eventuallyDue || [];
        
        // Check if any document-related requirement exists in ANY of the arrays
        const allRequirementArrays = [...currentlyDue, ...pastDue, ...eventuallyDue];
        const hasDocumentRequirement = allRequirementArrays.some((dueReq) => {
          const reqLower = dueReq.toLowerCase();
          return (
            reqLower.includes("verification.document") ||
            reqLower.includes("document.front") ||
            reqLower.includes("document.back") ||
            (reqLower.includes("individual") && reqLower.includes("verification"))
          );
        });
        
        // Documents are ONLY complete if:
        // 1. NO document requirements exist in ANY due list AND
        // 2. Payouts are enabled (which means all requirements including documents are satisfied)
        // This is the most conservative approach - we only mark complete when we're 100% sure
        step.completed = !hasDocumentRequirement && requirements?.payoutsEnabled === true;
        
        // If payouts aren't enabled, documents are definitely not complete
        if (requirements?.payoutsEnabled !== true) {
          step.completed = false;
        }
      } else if (step.id === "identity") {
        // Identity step: Always show it after personal info, regardless of Stripe requirements
        // Check if personal info (previous step) is complete
        const personalInfoStep = steps.find((s) => s.id === "personal-info");
        const personalInfoComplete = personalInfoStep?.completed ?? false;
        
        // If personal info is complete, ALWAYS show identity (mark it as incomplete)
        // This ensures we collect SSN even if Stripe doesn't require it yet
        if (personalInfoComplete) {
          step.completed = false; // Always show identity after personal info
        } else {
          // Personal info not complete yet, check identity requirements normally
          const hasIdentityRequirement = allDue.some((req: string) => {
            const reqLower = req.toLowerCase();
            return reqLower.includes("ssn") || reqLower.includes("id_number");
          });
          step.completed = !hasIdentityRequirement;
        }
      } else {
        // For other steps, check if any of this step's requirements are in the due list
        const hasMatchingRequirement = step.requirements.some((stepReq) =>
          allDue.some((dueReq) => requirementMatches(stepReq, dueReq))
        );
        // Step is completed if none of its requirements are due
        step.completed = !hasMatchingRequirement;
      }
    });

    // Always show all steps - don't filter them
    // This ensures users can always proceed through the flow
    return steps;
  };

  const steps = getSteps();
  const totalSteps = steps.length;
  const completedSteps = steps.filter((s) => s.completed).length;
  const progress = (completedSteps / totalSteps) * 100;
  
  // Find the first incomplete step
  const firstIncompleteStep = steps.find((s) => !s.completed);
  const currentStepIndex = firstIncompleteStep 
    ? steps.findIndex((s) => s.id === firstIncompleteStep.id)
    : steps.length - 1;
  const currentStep = steps[currentStepIndex] || steps[0];
  const currentStepNumber = currentStepIndex + 1;

  const handleNext = () => {
    if (currentStep) {
      router.push(currentStep.route as any);
    }
  };

  // Auto-redirect to the current step - no intermediate screen
  useEffect(() => {
    if (!loading && requirements && steps.length > 0) {
      // If payouts enabled, go to complete
      if (requirements?.payoutsEnabled) {
        router.replace("/payouts/complete");
        return;
      }

      // Find first incomplete step and redirect
      if (currentStep) {
        router.replace(currentStep.route as any);
      }
    }
  }, [loading, requirements, currentStep]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (requirements?.payoutsEnabled) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.completeSection}>
            <IconSymbol name="checkmark.circle.fill" size={80} color="#34C759" />
            <Text style={styles.completeTitle}>Setup Complete!</Text>
            <Text style={styles.completeText}>
              Your payout account is ready. You can now receive weekly payouts.
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => router.replace("/payouts")}
            >
              <Text style={styles.buttonText}>Go to Payouts</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Show loading while redirecting
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>Redirecting...</Text>
      </View>
    </SafeAreaView>
  );

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
        <Text style={styles.headerTitle}>Setup Payouts</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {testMode && (
          <View style={styles.testBanner}>
            <Text style={styles.testBannerText}>🧪 TEST MODE</Text>
          </View>
        )}

        {/* Step-by-Step Wizard View */}
        {steps.length === 0 ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#4285F4" />
            <Text style={styles.emptyStateText}>Loading requirements...</Text>
          </View>
        ) : currentStep ? (
          <View style={styles.wizardContainer}>
            {/* Progress Indicator */}
            <View style={styles.progressSection}>
              <Text style={styles.stepCounter}>
                Step {currentStepNumber} of {totalSteps}
              </Text>
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
              </View>
            </View>

            {/* Current Step Card */}
            <View style={styles.stepCard}>
              <View style={styles.stepIconLarge}>
                {currentStep.completed ? (
                  <IconSymbol name="checkmark.circle.fill" size={64} color="#34C759" />
                ) : (
                  <IconSymbol
                    name={currentStep.icon as any}
                    size={64}
                    color="#4285F4"
                  />
                )}
              </View>
              
              <Text style={styles.stepTitleLarge}>
                {currentStep.title}
              </Text>
              
              <Text style={styles.stepDescriptionLarge}>
                {currentStep.description}
              </Text>

              {currentStep.completed && (
                <View style={styles.completedBadge}>
                  <IconSymbol name="checkmark" size={16} color="#34C759" />
                  <Text style={styles.completedText}>Completed</Text>
                </View>
              )}
            </View>

            {/* Next Button */}
            <TouchableOpacity
              style={[styles.nextButton, currentStep.completed && styles.nextButtonCompleted]}
              onPress={handleNext}
            >
              <Text style={styles.nextButtonText}>
                {currentStep.completed ? "Continue" : "Next"}
              </Text>
              <IconSymbol name="arrow.right" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Step Indicators */}
            <View style={styles.stepIndicators}>
              {steps.map((step, index) => (
                <View
                  key={step.id}
                  style={[
                    styles.stepDot,
                    index === currentStepIndex && styles.stepDotActive,
                    step.completed && styles.stepDotCompleted,
                  ]}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* Debug section - show actual requirements in test mode */}
        {testMode && requirements && (
          <View style={styles.debugSection}>
            <TouchableOpacity
              style={styles.debugHeader}
              onPress={() => setShowDebug(!showDebug)}
            >
              <Text style={styles.debugTitle}>
                🔍 Debug: View Raw Requirements {showDebug ? "▼" : "▶"}
              </Text>
            </TouchableOpacity>
            {showDebug && requirements && (() => {
              const currentlyDue = requirements?.currentlyDue || [];
              const pastDue = requirements?.pastDue || [];
              const eventuallyDue = requirements?.eventuallyDue || [];
              
              return (
                <View style={styles.debugContent}>
                  <Text style={styles.debugLabel}>Currently Due ({currentlyDue.length}):</Text>
                  {currentlyDue.length > 0 ? (
                    currentlyDue.map((req, idx) => (
                      <Text key={idx} style={styles.debugItem}>  • {req}</Text>
                    ))
                  ) : (
                    <Text style={styles.debugItem}>  (none)</Text>
                  )}
                  
                  <Text style={[styles.debugLabel, { marginTop: 12, color: "#FF3B30" }]}>
                    Past Due ({pastDue.length}):
                  </Text>
                  {pastDue.length > 0 ? (
                    pastDue.map((req, idx) => (
                      <Text key={idx} style={[styles.debugItem, { color: "#FF3B30" }]}>  • {req}</Text>
                    ))
                  ) : (
                    <Text style={styles.debugItem}>  (none)</Text>
                  )}
                  
                  <Text style={[styles.debugLabel, { marginTop: 12 }]}>
                    Eventually Due ({eventuallyDue.length}):
                  </Text>
                  {eventuallyDue.length > 0 ? (
                    eventuallyDue.map((req, idx) => (
                      <Text key={idx} style={styles.debugItem}>  • {req}</Text>
                    ))
                  ) : (
                    <Text style={styles.debugItem}>  (none)</Text>
                  )}
                  
                  <Text style={[styles.debugLabel, { marginTop: 12 }]}>
                    Status: {requirements?.payoutsEnabled ? "✅ Payouts Enabled" : "⏳ Pending"}
                  </Text>
                  {requirements?.disabledReason && (
                    <Text style={[styles.debugItem, { color: "#FF9500" }]}>
                      Disabled Reason: {requirements?.disabledReason}
                    </Text>
                  )}
                </View>
              );
            })()}
            
            <Text style={[styles.debugItem, { marginTop: 12, fontSize: 10, fontStyle: "italic" }]}>
              Note: If you've submitted all info but still see past due requirements, 
              Stripe may need time to process. Try refreshing or wait a few moments.
            </Text>
            
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
            >
              <IconSymbol name="arrow.clockwise" size={16} color="#4285F4" />
              <Text style={styles.refreshButtonText}>Refresh Requirements</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Show disabled reason if account is restricted */}
        {requirements?.disabledReason && (
          <View style={styles.warningSection}>
            <IconSymbol name="exclamationmark.triangle.fill" size={24} color="#FF9500" />
            <View style={styles.warningTextContainer}>
              <Text style={styles.warningTitle}>Account Status</Text>
              <Text style={styles.warningText}>{requirements?.disabledReason}</Text>
              <Text style={styles.warningSubtext}>
                Complete the steps above to resolve this issue.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => loadRequirements()}
          >
            <IconSymbol name="arrow.clockwise" size={18} color="#4285F4" />
            <Text style={styles.refreshButtonText}>Refresh Status</Text>
          </TouchableOpacity>

          {testMode && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                Alert.alert(
                  "Reset Stripe Data",
                  "This will clear all Stripe data and let you start over. Continue?",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Reset",
                      style: "destructive",
                      onPress: async () => {
                        if (!user?.id) return;
                        try {
                          setLoading(true);
                          await resetStripeStatus(user.id);
                          Alert.alert(
                            "Success",
                            "Stripe data reset. Starting fresh...",
                            [
                              {
                                text: "OK",
                                onPress: () => router.replace("/payouts/setup"),
                              },
                            ]
                          );
                        } catch (error) {
                          Alert.alert("Error", getUserFriendlyErrorMessage(error));
                        } finally {
                          setLoading(false);
                        }
                      },
                    },
                  ]
                );
              }}
            >
              <IconSymbol name="arrow.counterclockwise" size={18} color="#FF9500" />
              <Text style={styles.resetButtonText}>Reset & Start Over</Text>
            </TouchableOpacity>
          )}
        </View>
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
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#666666",
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
  wizardContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 32,
  },
  progressSection: {
    width: "100%",
    marginBottom: 48,
    paddingHorizontal: 24,
  },
  stepCounter: {
    fontSize: 14,
    color: "#666666",
    fontWeight: "500",
    marginBottom: 12,
    textAlign: "center",
  },
  progressBarContainer: {
    width: "100%",
  },
  progressBar: {
    height: 6,
    backgroundColor: "#E5E5E5",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#4285F4",
    borderRadius: 3,
  },
  stepCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 40,
    marginBottom: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  stepIconLarge: {
    marginBottom: 24,
  },
  stepTitleLarge: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1A1A1A",
    marginBottom: 12,
    textAlign: "center",
  },
  stepDescriptionLarge: {
    fontSize: 16,
    color: "#666666",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 16,
  },
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  completedText: {
    fontSize: 14,
    color: "#34C759",
    fontWeight: "600",
  },
  nextButton: {
    backgroundColor: "#4285F4",
    borderRadius: 12,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    maxWidth: 400,
    marginBottom: 24,
  },
  nextButtonCompleted: {
    backgroundColor: "#34C759",
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  stepIndicators: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E5E5E5",
  },
  stepDotActive: {
    width: 24,
    backgroundColor: "#4285F4",
  },
  stepDotCompleted: {
    backgroundColor: "#34C759",
  },
  pastDueSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFEBEE",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#FF3B30",
  },
  pastDueTextContainer: {
    flex: 1,
  },
  pastDueTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FF3B30",
    marginBottom: 8,
  },
  pastDueText: {
    fontSize: 14,
    color: "#C62828",
    lineHeight: 20,
    marginBottom: 8,
  },
  pastDueCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FF3B30",
  },
  warningSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF4E6",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF9500",
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: "#FF9500",
    lineHeight: 20,
    marginBottom: 4,
  },
  warningSubtext: {
    fontSize: 12,
    color: "#FF9500",
    fontStyle: "italic",
  },
  actionButtons: {
    gap: 12,
    marginTop: 24,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    backgroundColor: "#E8F0FE",
    borderRadius: 8,
  },
  refreshButtonText: {
    fontSize: 14,
    color: "#4285F4",
    fontWeight: "500",
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    backgroundColor: "#FFF4E6",
    borderRadius: 8,
  },
  resetButtonText: {
    fontSize: 14,
    color: "#FF9500",
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#666666",
  },
  completeSection: {
    alignItems: "center",
    paddingVertical: 48,
  },
  completeTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1A1A1A",
    marginTop: 16,
    marginBottom: 8,
  },
  completeText: {
    fontSize: 16,
    color: "#666666",
    textAlign: "center",
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  button: {
    backgroundColor: "#4285F4",
    borderRadius: 8,
    padding: 16,
    minWidth: 200,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  debugSection: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    overflow: "hidden",
  },
  debugHeader: {
    padding: 12,
    backgroundColor: "#E8E8E8",
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666666",
  },
  debugContent: {
    padding: 12,
  },
  debugLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#333333",
    marginBottom: 4,
  },
  debugItem: {
    fontSize: 11,
    color: "#666666",
    fontFamily: "monospace",
    marginLeft: 8,
    marginBottom: 2,
  },
});
