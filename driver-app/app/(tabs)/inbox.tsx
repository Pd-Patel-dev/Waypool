import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface InboxItem {
  id: number;
  type: 'request' | 'message';
  from: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  pickupLocation?: string;
  destination?: string;
  requestedSeats?: number;
  price?: number;
}

export default function InboxScreen(): React.JSX.Element {
  const [selectedTab, setSelectedTab] = useState<'all' | 'requests' | 'messages'>('all');

  // Mock inbox data
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([
    {
      id: 1,
      type: 'request',
      from: 'Sarah Johnson',
      title: 'Ride Request',
      message: 'Requested a ride from Downtown to Airport',
      time: '5 min ago',
      unread: true,
      pickupLocation: 'Downtown, Main St',
      destination: 'SFO Airport',
      requestedSeats: 2,
      price: 85,
    },
    {
      id: 2,
      type: 'message',
      from: 'Mike Chen',
      title: 'Message',
      message: 'Thanks for the smooth ride yesterday!',
      time: '1 hour ago',
      unread: true,
    },
    {
      id: 3,
      type: 'request',
      from: 'Emma Davis',
      title: 'Ride Request',
      message: 'Requested a ride from Market St to Union Square',
      time: '2 hours ago',
      unread: false,
      pickupLocation: 'Market Street, SF',
      destination: 'Union Square',
      requestedSeats: 1,
      price: 25,
    },
    {
      id: 4,
      type: 'message',
      from: 'James Wilson',
      title: 'Message',
      message: 'Can we make a quick stop at the gas station?',
      time: '3 hours ago',
      unread: false,
    },
    {
      id: 5,
      type: 'request',
      from: 'Lisa Anderson',
      title: 'Ride Request',
      message: 'Requested a ride from Castro to Mission District',
      time: 'Yesterday',
      unread: false,
      pickupLocation: 'Castro Street',
      destination: 'Mission District',
      requestedSeats: 3,
      price: 45,
    },
  ]);

  const filteredItems = inboxItems.filter(item => {
    if (selectedTab === 'all') return true;
    if (selectedTab === 'requests') return item.type === 'request';
    if (selectedTab === 'messages') return item.type === 'message';
    return true;
  });

  const unreadCount = inboxItems.filter(item => item.unread).length;

  const handleItemPress = (item: InboxItem) => {
    console.log('Inbox item pressed:', item);
    
    // Mark as read when tapped
    setInboxItems(prevItems =>
      prevItems.map(i => i.id === item.id ? { ...i, unread: false } : i)
    );
    
    // TODO: Navigate to detail screen or open chat
    if (item.type === 'message') {
      // Open message/chat screen
      console.log('Opening chat with:', item.from);
    } else {
      // Show ride request details
      console.log('Showing ride request details');
    }
  };

  const handleAcceptRequest = (id: number) => {
    console.log('Accepting request:', id);
    
    // Animate out and remove
    const item = inboxItems.find(i => i.id === id);
    if (item) {
      // Remove the request from inbox after accepting
      setInboxItems(prevItems => prevItems.filter(item => item.id !== id));
      
      // TODO: Call API to accept ride request
      // Show success feedback (you could add a toast notification here)
      console.log('✓ Ride request accepted!');
    }
  };

  const handleDeclineRequest = (id: number) => {
    console.log('Declining request:', id);
    
    // Remove the request from inbox after declining
    setInboxItems(prevItems => prevItems.filter(item => item.id !== id));
    
    // TODO: Call API to decline ride request
    console.log('✗ Ride request declined.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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

      {/* Tab Filters */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'all' && styles.tabActive]}
          onPress={() => setSelectedTab('all')}
          activeOpacity={0.7}>
          <Text style={[styles.tabText, selectedTab === 'all' && styles.tabTextActive]}>
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedTab === 'requests' && styles.tabActive]}
          onPress={() => setSelectedTab('requests')}
          activeOpacity={0.7}>
          <Text style={[styles.tabText, selectedTab === 'requests' && styles.tabTextActive]}>
            Requests
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedTab === 'messages' && styles.tabActive]}
          onPress={() => setSelectedTab('messages')}
          activeOpacity={0.7}>
          <Text style={[styles.tabText, selectedTab === 'messages' && styles.tabTextActive]}>
            Messages
          </Text>
        </TouchableOpacity>
      </View>

      {/* Inbox List */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        
        {filteredItems.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol size={48} name="envelope" color="#666666" />
            <Text style={styles.emptyText}>No {selectedTab === 'all' ? 'items' : selectedTab}</Text>
            <Text style={styles.emptySubtext}>You're all caught up!</Text>
          </View>
        ) : (
          filteredItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.inboxItem, item.unread && styles.inboxItemUnread]}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.7}>
              
              <View style={styles.itemLeft}>
                <View style={[
                  styles.avatarContainer,
                  item.type === 'request' && styles.avatarRequest
                ]}>
                  <IconSymbol 
                    size={22} 
                    name={item.type === 'request' ? 'car' : 'envelope.fill'} 
                    color={item.type === 'request' ? '#4285F4' : '#9D4EDD'} 
                  />
                </View>

                <View style={styles.itemContent}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemFrom}>{item.from}</Text>
                    {item.unread && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemMessage}>{item.message}</Text>
                  
                  {item.type === 'request' && item.pickupLocation && (
                    <View style={styles.requestDetails}>
                      <View style={styles.routeInfo}>
                        <IconSymbol size={12} name="location" color="#4285F4" />
                        <Text style={styles.routeText}>{item.pickupLocation}</Text>
                      </View>
                      <View style={styles.routeInfo}>
                        <IconSymbol size={12} name="flag" color="#FF3B30" />
                        <Text style={styles.routeText}>{item.destination}</Text>
                      </View>
                      <View style={styles.requestMeta}>
                        <Text style={styles.metaText}>{item.requestedSeats} seat{item.requestedSeats !== 1 ? 's' : ''}</Text>
                        <Text style={styles.metaDot}>•</Text>
                        <Text style={styles.metaPrice}>${item.price}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.itemRight}>
                <Text style={styles.itemTime}>{item.time}</Text>
                {item.type === 'request' && (
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleAcceptRequest(item.id);
                      }}
                      activeOpacity={0.7}>
                      <IconSymbol size={16} name="checkmark" color="#000000" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.declineButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeclineRequest(item.id);
                      }}
                      activeOpacity={0.7}>
                      <Text style={styles.declineIcon}>×</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4285F4',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  tab: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#0F0F0F',
    borderWidth: 1.5,
    borderColor: '#1A1A1A',
  },
  tabActive: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
    shadowColor: '#4285F4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    opacity: 0.5,
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: '#000000',
    opacity: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  emptySubtext: {
    fontSize: 15,
    fontWeight: '500',
    color: '#4285F4',
    opacity: 0.7,
  },
  inboxItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0F0F0F',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  inboxItemUnread: {
    borderWidth: 2,
    borderColor: '#4285F4',
  },
  itemLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: 12,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarRequest: {
    backgroundColor: '#1A1A1A',
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  itemFrom: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4285F4',
  },
  itemTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.6,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemMessage: {
    fontSize: 14,
    fontWeight: '400',
    color: '#FFFFFF',
    opacity: 0.8,
    lineHeight: 20,
    marginBottom: 8,
  },
  requestDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    gap: 8,
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  routeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.9,
    flex: 1,
  },
  requestMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.6,
  },
  metaDot: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.3,
  },
  metaPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4285F4',
  },
  itemRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginLeft: 12,
  },
  itemTime: {
    fontSize: 11,
    fontWeight: '500',
    color: '#FFFFFF',
    opacity: 0.5,
    marginBottom: 8,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineIcon: {
    fontSize: 24,
    fontWeight: '300',
    color: '#FFFFFF',
    lineHeight: 24,
  },
});
