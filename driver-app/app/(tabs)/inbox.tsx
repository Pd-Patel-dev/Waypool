import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, router } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useUser } from "@/context/UserContext";
import {
  getNotifications,
  markNotificationRead,
  acceptBooking,
  rejectBooking,
  type Notification,
} from "@/services/api";
import { Alert } from "react-native";

export default function InboxScreen(): React.JSX.Element {
  const { user } = useUser();
  const [selectedTab, setSelectedTab] = useState<
    "all" | "requests" | "messages"
  >("all");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const driverId =
        typeof user.id === "string" ? parseInt(user.id) : user.id;
      const response = await getNotifications(driverId);
      if (response.success) {
        setNotifications(response.notifications);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const filteredItems = notifications.filter((item) => {
    if (selectedTab === "all") return true;
    if (selectedTab === "requests") return item.type === "booking";
    if (selectedTab === "messages") return item.type === "message";
    return true;
  });

  const unreadCount = notifications.filter((item) => item.unread).length;

  const handleItemPress = async (item: Notification) => {
    if (!user?.id) return;

    // Mark as read when tapped
    if (item.unread) {
      try {
        const driverId =
          typeof user.id === "string" ? parseInt(user.id) : user.id;
        await markNotificationRead(item.id, driverId);
        setNotifications((prevItems) =>
          prevItems.map((i) => (i.id === item.id ? { ...i, unread: false } : i))
        );
      } catch (error) {
        console.error("Error marking notification as read:", error);
      }
    }

    // Navigate to detail screen
    if (item.type === "message") {
      // Open message/chat screen
      console.log("Opening chat");
    } else if (item.type === "booking" && item.booking) {
      // Navigate to booking request details screen
      router.push({
        pathname: "/booking-request",
        params: {
          notification: JSON.stringify(item),
        },
      });
    }
  };

  const handleAcceptRequest = async (notificationId: number) => {
    if (!user?.id) return;

    const notification = notifications.find((n) => n.id === notificationId);
    if (!notification || !notification.booking) {
      Alert.alert("Error", "Booking information not found");
      return;
    }

    // Check if booking is still pending
    if (notification.booking.status !== "pending") {
      Alert.alert(
        "Already Processed",
        "This booking request has already been processed."
      );
      return;
    }

    Alert.alert(
      "Accept Request",
      `Accept ${notification.booking.rider.fullName}'s request for ${
        notification.booking.numberOfSeats
      } seat${notification.booking.numberOfSeats !== 1 ? "s" : ""}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Accept",
          onPress: async () => {
            try {
              const driverId =
                typeof user.id === "string" ? parseInt(user.id) : user.id;
              await acceptBooking(notification.booking!.id, driverId);

              // Refresh notifications
              await fetchNotifications();

              Alert.alert("Success", "Booking request accepted!");
            } catch (error: any) {
              console.error("Error accepting booking:", error);
              Alert.alert(
                "Error",
                error.message || "Failed to accept booking request"
              );
            }
          },
        },
      ]
    );
  };

  const handleDeclineRequest = async (notificationId: number) => {
    if (!user?.id) return;

    const notification = notifications.find((n) => n.id === notificationId);
    if (!notification || !notification.booking) {
      Alert.alert("Error", "Booking information not found");
      return;
    }

    // Check if booking is still pending
    if (notification.booking.status !== "pending") {
      Alert.alert(
        "Already Processed",
        "This booking request has already been processed."
      );
      return;
    }

    Alert.alert(
      "Reject Request",
      `Reject ${notification.booking.rider.fullName}'s request for ${
        notification.booking.numberOfSeats
      } seat${notification.booking.numberOfSeats !== 1 ? "s" : ""}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              const driverId =
                typeof user.id === "string" ? parseInt(user.id) : user.id;
              await rejectBooking(notification.booking!.id, driverId);

              // Refresh notifications
              await fetchNotifications();

              Alert.alert("Success", "Booking request rejected.");
            } catch (error: any) {
              console.error("Error rejecting booking:", error);
              Alert.alert(
                "Error",
                error.message || "Failed to reject booking request"
              );
            }
          },
        },
      ]
    );
  };

  // Convert notification to inbox item format
  const notificationToInboxItem = (notification: Notification) => {
    if (notification.type === "booking" && notification.booking) {
      return {
        id: notification.id,
        type: "request" as const,
        from: notification.booking.rider.fullName,
        title: notification.title,
        message: notification.message,
        time: notification.time,
        unread: notification.unread,
        pickupLocation: notification.booking.pickupAddress,
        destination: `${notification.booking.ride.toAddress}, ${notification.booking.ride.toCity}`,
        requestedSeats: notification.booking.numberOfSeats,
        price:
          notification.booking.ride.pricePerSeat *
          notification.booking.numberOfSeats,
        bookingStatus: notification.booking.status, // Include booking status
      };
    } else {
      return {
        id: notification.id,
        type: "message" as const,
        from: "System",
        title: notification.title,
        message: notification.message,
        time: notification.time,
        unread: notification.unread,
      };
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Inbox</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSubtitle}>{unreadCount} unread</Text>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === "all" && styles.tabActive]}
          onPress={() => setSelectedTab("all")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === "all" && styles.tabTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === "requests" && styles.tabActive]}
          onPress={() => setSelectedTab("requests")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === "requests" && styles.tabTextActive,
            ]}
          >
            Requests
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === "messages" && styles.tabActive]}
          onPress={() => setSelectedTab("messages")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === "messages" && styles.tabTextActive,
            ]}
          >
            Messages
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSymbol name="envelope" size={48} color="#666666" />
          <Text style={styles.emptyText}>No notifications</Text>
          <Text style={styles.emptySubtext}>
            {selectedTab === "all"
              ? "You have no notifications"
              : selectedTab === "requests"
              ? "You have no ride requests"
              : "You have no messages"}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4285F4"
            />
          }
          showsVerticalScrollIndicator={true}
        >
          {filteredItems.map((notification) => {
            const item = notificationToInboxItem(notification);

            return (
              <TouchableOpacity
                key={notification.id}
                style={[styles.item, item.unread && styles.itemUnread]}
                onPress={() => handleItemPress(notification)}
                activeOpacity={0.7}
              >
                <View style={styles.itemLeft}>
                  <View
                    style={[
                      styles.avatar,
                      item.type === "request"
                        ? styles.avatarRequest
                        : styles.avatarMessage,
                    ]}
                  >
                    <Text style={styles.avatarText}>
                      {item.from.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.itemContent}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemFrom}>{item.from}</Text>
                      {item.unread && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemMessage} numberOfLines={2}>
                      {item.message}
                    </Text>
                    {item.type === "request" && item.pickupLocation && (
                      <View style={styles.requestDetails}>
                        <Text style={styles.requestDetailText}>
                          📍 {item.pickupLocation}
                        </Text>
                        {item.destination && (
                          <Text style={styles.requestDetailText}>
                            → {item.destination}
                          </Text>
                        )}
                        {item.requestedSeats && (
                          <Text style={styles.requestDetailText}>
                            👥 {item.requestedSeats} seat
                            {item.requestedSeats !== 1 ? "s" : ""}
                          </Text>
                        )}
                        {item.price && (
                          <Text style={styles.requestDetailText}>
                            💰 ${item.price.toFixed(2)}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.itemRight}>
                  <Text style={styles.itemTime}>{item.time}</Text>
                  {item.type === "request" &&
                    "bookingStatus" in item &&
                    item.bookingStatus === "pending" && (
                      <View style={styles.requestActions}>
                        <TouchableOpacity
                          style={styles.acceptButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleAcceptRequest(notification.id);
                          }}
                          activeOpacity={0.7}
                        >
                          <IconSymbol
                            size={16}
                            name="checkmark"
                            color="#000000"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.declineButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDeclineRequest(notification.id);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.declineIcon}>×</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  {item.type === "request" &&
                    "bookingStatus" in item &&
                    item.bookingStatus === "confirmed" && (
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>Accepted</Text>
                      </View>
                    )}
                  {item.type === "request" &&
                    "bookingStatus" in item &&
                    item.bookingStatus === "rejected" && (
                      <View
                        style={[styles.statusBadge, styles.statusBadgeRejected]}
                      >
                        <Text style={styles.statusText}>Rejected</Text>
                      </View>
                    )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#000000",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: "400",
    color: "#999999",
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#000000",
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
    gap: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#1C1C1E",
  },
  tabActive: {
    backgroundColor: "#4285F4",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#999999",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: "400",
    color: "#999999",
    textAlign: "center",
  },
  item: {
    flexDirection: "row",
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A2A2C",
  },
  itemUnread: {
    borderColor: "#4285F4",
    borderWidth: 2,
  },
  itemLeft: {
    flex: 1,
    flexDirection: "row",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarRequest: {
    backgroundColor: "#4285F4",
  },
  avatarMessage: {
    backgroundColor: "#34C759",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  itemFrom: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginRight: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4285F4",
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  itemMessage: {
    fontSize: 13,
    fontWeight: "400",
    color: "#999999",
    lineHeight: 18,
    marginBottom: 8,
  },
  requestDetails: {
    marginTop: 8,
    gap: 4,
  },
  requestDetailText: {
    fontSize: 12,
    fontWeight: "400",
    color: "#999999",
  },
  itemRight: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginLeft: 12,
  },
  itemTime: {
    fontSize: 11,
    fontWeight: "400",
    color: "#666666",
    marginBottom: 8,
  },
  requestActions: {
    flexDirection: "row",
    gap: 8,
  },
  acceptButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#34C759",
    justifyContent: "center",
    alignItems: "center",
  },
  declineButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
  },
  declineIcon: {
    fontSize: 20,
    fontWeight: "300",
    color: "#FFFFFF",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#34C759",
  },
  statusBadgeRejected: {
    backgroundColor: "#FF3B30",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
