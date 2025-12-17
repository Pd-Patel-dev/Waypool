import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, router } from "expo-router";
import { useUser } from "@/context/UserContext";
import {
  getNotifications,
  markNotificationRead,
  acceptBooking,
  rejectBooking,
  type Notification,
} from "@/services/api";

// Import new components
import {
  NotificationItem,
  NotificationFilters,
  EmptyState,
} from "@/components/inbox";

export default function InboxScreen(): React.JSX.Element {
  const { user } = useUser();
  const [selectedTab, setSelectedTab] = useState<"all" | "requests">("all");
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
    return true;
  });

  const unreadCount = notifications.filter((item) => item.unread).length;

  const openSMS = (phoneNumber: string) => {
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    const smsUrl = `sms:${cleanPhone}`;

    Linking.canOpenURL(smsUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(smsUrl);
        } else {
          Alert.alert("Error", "Unable to open messaging app");
        }
      })
      .catch(() => {
        Alert.alert("Error", "Unable to open messaging app");
      });
  };

  const handleItemPress = async (item: Notification) => {
    if (!user?.id) return;

    // Mark as read
    if (item.unread) {
      try {
        const driverId = typeof user.id === "string" ? parseInt(user.id) : user.id;
        await markNotificationRead(item.id, driverId);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, unread: false } : n))
        );
      } catch (error) {
        console.error("Error marking notification as read:", error);
      }
    }

    // Handle booking requests
    if (item.type === "booking" && item.booking) {
      Alert.alert(
        "Booking Request",
        `${item.booking.rider.fullName} wants to book ${item.booking.numberOfSeats} seat(s) for ${item.booking.ride.fromCity} → ${item.booking.ride.toCity}`,
        [
          {
            text: "Reject",
            style: "destructive",
            onPress: () => handleRejectBooking(item.booking!.id),
          },
          {
            text: "Message",
            onPress: () => openSMS(item.booking!.rider.phoneNumber),
          },
          {
            text: "Accept",
            onPress: () => handleAcceptBooking(item.booking!.id),
          },
        ]
      );
    }

    // Handle ride-started notifications
    if (item.type === "ride-started") {
      router.push(`/current-ride?rideId=${item.ride?.id}`);
    }
  };

  const handleAcceptBooking = async (bookingId: number) => {
    if (!user?.id) return;

    try {
      const driverId = typeof user.id === "string" ? parseInt(user.id) : user.id;
      await acceptBooking(bookingId, driverId);
      Alert.alert("Success", "Booking accepted!");
      fetchNotifications();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to accept booking");
    }
  };

  const handleRejectBooking = async (bookingId: number) => {
    if (!user?.id) return;

    try {
      const driverId = typeof user.id === "string" ? parseInt(user.id) : user.id;
      await rejectBooking(bookingId, driverId);
      Alert.alert("Booking Rejected", "The booking has been declined.");
      fetchNotifications();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to reject booking");
    }
  };

  // Loading state
  if (isLoading && notifications.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.content}>
        {/* Filters */}
        <NotificationFilters
          selectedTab={selectedTab}
          unreadCount={unreadCount}
          onTabChange={setSelectedTab}
        />

        {/* Notifications List */}
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <NotificationItem
              notification={item}
              onPress={handleItemPress}
            />
          )}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <EmptyState
              icon="bell.slash.fill"
              title={selectedTab === "requests" ? "No Booking Requests" : "No Notifications"}
              description={
                selectedTab === "requests"
                  ? "You don't have any booking requests at the moment"
                  : "You're all caught up! Check back later for updates."
              }
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4285F4"
            />
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    flexGrow: 1,
  },
  separator: {
    height: 12,
  },
});
