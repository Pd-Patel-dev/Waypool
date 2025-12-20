/**
 * Helper function to navigate to the next incomplete payout step
 */

import { router } from "expo-router";
import { getConnectRequirements, clearBusinessProfile, type ConnectRequirements } from "@/services/api";

export async function navigateToNextStep(userId: number): Promise<void> {
  try {
    // Get current requirements
    let requirements = await getConnectRequirements(userId);

    // Clear business_profile if needed
    if (
      (requirements.currentlyDue || []).some((req: string) => req.includes("business_profile")) ||
      (requirements.pastDue || []).some((req: string) => req.includes("business_profile"))
    ) {
      requirements = await clearBusinessProfile(userId);
    }

    // If payouts enabled, go to complete
    if (requirements.payoutsEnabled) {
      router.replace("/payouts/complete");
      return;
    }

    // Define steps in order
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
      // Check if any of this step's requirements are in the due list
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

    // Step 2: Identity (ALWAYS show after personal info, regardless of Stripe requirements)
    // Stripe may not require SSN immediately (especially in test mode), but we always collect it
    // This ensures we have SSN ready when Stripe needs it, and it's good practice to collect it early
    // We always show identity after personal info to ensure we collect SSN
    // Only skip if we can verify SSN is already provided (check if identity step is complete AND no SSN requirements)
    const identityRequirementsDue = allDue.some((req: string) => {
      const reqLower = req.toLowerCase();
      return reqLower.includes("ssn") || reqLower.includes("id_number");
    });
    
    // Always show identity if:
    // 1. Stripe requires it (identityRequirementsDue = true), OR
    // 2. We can't verify it's already provided (identity step appears incomplete)
    // This ensures we always collect SSN after personal info
    if (identityRequirementsDue || !isStepComplete(steps[1])) {
      router.replace(steps[1].route as any);
      return;
    }
    
    // Identity appears complete (SSN not required by Stripe and step appears done)
    // This might happen if SSN was already submitted or Stripe doesn't need it yet
    // Continue to bank account
    // Step 3: Bank Account
    const bankAccountComplete = isStepComplete(steps[2]);
    if (!bankAccountComplete) {
      router.replace(steps[2].route as any);
      return;
    }

    // Step 4: Documents (ALWAYS show after bank account is complete)
    // Stripe may not require documents immediately, but we always collect them
    // This ensures we have identity documents ready when Stripe needs them
    // Only skip if payouts are already enabled (meaning everything is complete)
    if (!requirements.payoutsEnabled) {
      router.replace(steps[3].route as any);
      return;
    }

    // All steps complete - payouts are enabled
    router.replace("/payouts/complete");
  } catch (error) {
    console.error("Error navigating to next step:", error);
    // Fallback to checklist
    router.replace("/payouts/checklist");
  }
}

