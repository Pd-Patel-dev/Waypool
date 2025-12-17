import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Share,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useUser } from "@/context/UserContext";
import { getRideById, submitRating, type Ride, type Passenger, type ApiError } from "@/services/api";

interface RatingState {
  [passengerId: number]: {
    rating: number;
    feedback: string;
    submitted: boolean;
    submitting: boolean;
  };
}

export default function RideCompletionScreen(): React.JSX.Element {
  const params = useLocalSearchParams();
  const { user } = useUser();
  const totalEarnings = params.totalEarnings
    ? parseFloat(params.totalEarnings as string)
    : 0;
  const rideId = params.rideId ? parseInt(params.rideId as string) : null;

  const [rideData, setRideData] = useState<Ride | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [ratings, setRatings] = useState<RatingState>({});

  useEffect(() => {
    if (rideId && user?.id) {
      fetchRideDetails();
    } else {
      setIsLoading(false);
    }
  }, [rideId, user?.id]);

  const fetchRideDetails = async () => {
    if (!rideId || !user?.id) return;
    
    try {
      setIsLoading(true);
      const ride = await getRideById(rideId, user.id);
      setRideData(ride);
      
      // Initialize ratings state for all passengers
      if (ride.passengers) {
        const initialRatings: RatingState = {};
        ride.passengers.forEach((passenger) => {
          if (passenger.id && passenger.riderId) {
            initialRatings[passenger.id] = {
              rating: 0,
              feedback: "",
              submitted: false,
              submitting: false,
            };
          }
        });
        setRatings(initialRatings);
      }
    } catch (error) {
      console.error("Error fetching ride details:", error);
      Alert.alert("Error", "Failed to load ride details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRatingChange = (passengerId: number, rating: number) => {
    setRatings((prev) => ({
      ...prev,
      [passengerId]: {
        ...prev[passengerId],
        rating,
      },
    }));
  };

  const handleFeedbackChange = (passengerId: number, feedback: string) => {
    setRatings((prev) => ({
      ...prev,
      [passengerId]: {
        ...prev[passengerId],
        feedback,
      },
    }));
  };

  const handleSubmitRating = async (passenger: Passenger) => {
    if (!rideId || !user?.id || !passenger.id || !passenger.riderId) return;
    
    const ratingState = ratings[passenger.id];
    if (!ratingState || ratingState.rating === 0) {
      Alert.alert("Rating Required", "Please select a rating (1-5 stars)");
      return;
    }

    try {
      setRatings((prev) => ({
        ...prev,
        [passenger.id]: {
          ...prev[passenger.id],
          submitting: true,
        },
      }));

      await submitRating(
        rideId,
        passenger.id,
        user.id,
        passenger.riderId,
        ratingState.rating,
        ratingState.feedback.trim() || undefined
      );

      setRatings((prev) => ({
        ...prev,
        [passenger.id]: {
          ...prev[passenger.id],
          submitted: true,
          submitting: false,
        },
      }));
    } catch (error: any) {
      const apiError = error as ApiError;
      Alert.alert("Error", apiError.message || "Failed to submit rating");
      setRatings((prev) => ({
        ...prev,
        [passenger.id]: {
          ...prev[passenger.id],
          submitting: false,
        },
      }));
    }
  };

  const handleShareEarnings = async () => {
    try {
      const message = `🚗 Ride Completed!\n\n💰 Total Earnings: $${totalEarnings.toFixed(2)}\n${rideData ? `📍 Route: ${rideData.fromCity || rideData.fromAddress} → ${rideData.toCity || rideData.toAddress}` : ''}\n\nThank you for using Waypool!`;
      
      const result = await Share.share({
        message,
        title: "Ride Earnings",
      });

      if (result.action === Share.sharedAction) {
        console.log("Earnings shared successfully");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to share earnings");
    }
  };

  const formatDuration = (minutes: number | undefined): string => {
    if (!minutes) return "N/A";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const calculateTotalStops = (): number => {
    if (!rideData?.passengers) return 0;
    return rideData.passengers.length;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Loading ride details...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
          Thank you for completing the ride. Rate your passengers below.
        </Text>

        {/* Ride Summary Card */}
        {rideData && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Ride Summary</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <IconSymbol size={20} name="map.fill" color="#4285F4" />
                <Text style={styles.summaryLabel}>Distance</Text>
                <Text style={styles.summaryValue}>
                  {rideData.distance ? `${rideData.distance.toFixed(1)} mi` : "N/A"}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <IconSymbol size={20} name="clock.fill" color="#4285F4" />
                <Text style={styles.summaryLabel}>Duration</Text>
                <Text style={styles.summaryValue}>
                  {formatDuration(rideData.estimatedTimeMinutes)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <IconSymbol size={20} name="mappin.circle.fill" color="#4285F4" />
                <Text style={styles.summaryLabel}>Stops</Text>
                <Text style={styles.summaryValue}>{calculateTotalStops()}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Earnings Card */}
        <View style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>Total Earnings</Text>
          <Text style={styles.earningsAmount}>${totalEarnings.toFixed(2)}</Text>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShareEarnings}
            activeOpacity={0.7}
          >
            <IconSymbol size={18} name="square.and.arrow.up" color="#4285F4" />
            <Text style={styles.shareButtonText}>Share Earnings</Text>
          </TouchableOpacity>
        </View>

        {/* Ratings Section */}
        {rideData?.passengers && rideData.passengers.length > 0 && (
          <View style={styles.ratingsSection}>
            <Text style={styles.sectionTitle}>Rate Your Passengers</Text>
            {rideData.passengers.map((passenger, index) => {
              if (!passenger.id || !passenger.riderId) return null;
              
              const ratingState = ratings[passenger.id];
              const isSubmitted = ratingState?.submitted || false;
              const isSubmitting = ratingState?.submitting || false;

              return (
                <View key={passenger.id || index} style={styles.ratingCard}>
                  <Text style={styles.passengerName}>
                    {passenger.riderName || `Passenger ${index + 1}`}
                  </Text>
                  
                  {!isSubmitted ? (
                    <>
                      {/* Star Rating */}
                      <View style={styles.starContainer}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <TouchableOpacity
                            key={star}
                            onPress={() => handleRatingChange(passenger.id!, star)}
                            activeOpacity={0.7}
                            disabled={isSubmitting}
                          >
                            <IconSymbol
                              size={32}
                              name={
                                star <= (ratingState?.rating || 0)
                                  ? "star.fill"
                                  : "star"
                              }
                              color={
                                star <= (ratingState?.rating || 0)
                                  ? "#FFD700"
                                  : "#666666"
                              }
                            />
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Feedback Input */}
                      <TextInput
                        style={styles.feedbackInput}
                        placeholder="Optional feedback..."
                        placeholderTextColor="#666666"
                        value={ratingState?.feedback || ""}
                        onChangeText={(text) =>
                          handleFeedbackChange(passenger.id!, text)
                        }
                        multiline
                        numberOfLines={3}
                        editable={!isSubmitting}
                      />

                      {/* Submit Button */}
                      <TouchableOpacity
                        style={[
                          styles.submitRatingButton,
                          isSubmitting && styles.submitRatingButtonDisabled,
                        ]}
                        onPress={() => handleSubmitRating(passenger)}
                        activeOpacity={0.7}
                        disabled={isSubmitting || (ratingState?.rating || 0) === 0}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.submitRatingButtonText}>
                            Submit Rating
                          </Text>
                        )}
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={styles.ratedBadge}>
                      <IconSymbol size={20} name="checkmark.circle.fill" color="#34C759" />
                      <Text style={styles.ratedText}>Rated {ratingState?.rating || 0} stars</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Done Button */}
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => {
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#999999",
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
  summaryCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  summaryItem: {
    alignItems: "center",
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#999999",
    marginTop: 8,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
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
    marginBottom: 16,
    letterSpacing: -1,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#4285F4",
    borderRadius: 8,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4285F4",
  },
  ratingsSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  ratingCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  passengerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  starContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  feedbackInput: {
    backgroundColor: "#0A0A0A",
    borderRadius: 8,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    textAlignVertical: "top",
    minHeight: 80,
  },
  submitRatingButton: {
    backgroundColor: "#4285F4",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  submitRatingButtonDisabled: {
    opacity: 0.5,
  },
  submitRatingButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  ratedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    backgroundColor: "rgba(52, 199, 89, 0.1)",
    borderRadius: 8,
  },
  ratedText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#34C759",
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
