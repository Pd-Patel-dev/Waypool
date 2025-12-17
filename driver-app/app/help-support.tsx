import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    question: 'How do I start a ride?',
    answer: 'Go to the Home tab, tap "Add Ride", fill in your route details, date, time, and number of seats. Once passengers book, you can start the ride from the Current Ride screen.',
  },
  {
    question: 'How do I pick up passengers?',
    answer: 'When you arrive at a passenger\'s pickup location, the app will show "Ready to Pickup". Tap it and enter the 4-digit PIN that the passenger provides to verify the pickup.',
  },
  {
    question: 'What if a passenger doesn\'t show up?',
    answer: 'You can wait a reasonable amount of time (5-10 minutes). If they don\'t arrive, you can proceed with other passengers. The ride will still be completed.',
  },
  {
    question: 'How do I get paid?',
    answer: 'Earnings are automatically tracked in the Earnings tab. Payouts are processed weekly. You can view your earnings history and pending payouts there.',
  },
  {
    question: 'Can I cancel a ride?',
    answer: 'Yes, you can cancel a ride before it starts. Go to the ride details and tap "Cancel Ride". Passengers will be notified and refunded automatically.',
  },
  {
    question: 'How do I contact a passenger?',
    answer: 'In the booking request or current ride screen, you can tap the call or message button to contact passengers directly through their phone.',
  },
  {
    question: 'What if I have technical issues?',
    answer: 'Try restarting the app first. If the issue persists, contact support using the button below. Make sure to include details about what happened.',
  },
  {
    question: 'How do I update my vehicle information?',
    answer: 'Go to Menu → My Vehicle. You can update your car make, model, year, and color at any time.',
  },
];

export default function HelpSupportScreen(): React.JSX.Element {
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contact Support',
      'Choose how you would like to contact support:',
      [
        {
          text: 'Email',
          onPress: () => {
            Linking.openURL('mailto:support@waypool.com?subject=Driver App Support Request').catch(() => {
              Alert.alert('Error', 'Unable to open email. Please email support@waypool.com directly.');
            });
          },
        },
        {
          text: 'Phone',
          onPress: () => {
            Linking.openURL('tel:+18005551234').catch(() => {
              Alert.alert('Error', 'Unable to make phone call.');
            });
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleReportIssue = () => {
    Alert.alert(
      'Report Issue',
      'Please describe the issue you\'re experiencing:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Open Email',
          onPress: () => {
            const subject = encodeURIComponent('Driver App Issue Report');
            const body = encodeURIComponent(
              'Please describe the issue:\n\n' +
              'Device: [Your device]\n' +
              'App Version: 1.0.0\n' +
              'Issue:\n\n'
            );
            Linking.openURL(`mailto:support@waypool.com?subject=${subject}&body=${body}`).catch(() => {
              Alert.alert('Error', 'Unable to open email. Please email support@waypool.com directly.');
            });
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleContactSupport}
            activeOpacity={0.7}
          >
            <View style={styles.actionIcon}>
              <IconSymbol size={20} name="envelope.fill" color="#4285F4" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Contact Support</Text>
              <Text style={styles.actionSubtitle}>Get help from our support team</Text>
            </View>
            <IconSymbol size={18} name="chevron.right" color="#666666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleReportIssue}
            activeOpacity={0.7}
          >
            <View style={styles.actionIcon}>
              <IconSymbol size={20} name="exclamationmark.triangle.fill" color="#FF9500" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Report an Issue</Text>
              <Text style={styles.actionSubtitle}>Report bugs or technical problems</Text>
            </View>
            <IconSymbol size={18} name="chevron.right" color="#666666" />
          </TouchableOpacity>
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          
          {FAQ_DATA.map((faq, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.faqItem,
                index === FAQ_DATA.length - 1 && styles.faqItemLast,
              ]}
              onPress={() => toggleFAQ(index)}
              activeOpacity={0.7}
            >
              <View style={styles.faqHeader}>
                <Text style={styles.faqQuestion}>{faq.question}</Text>
                <IconSymbol
                  size={18}
                  name={expandedFAQ === index ? "chevron.up" : "chevron.down"}
                  color="#666666"
                />
              </View>
              {expandedFAQ === index && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Legal Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => {
              Alert.alert('Terms of Service', 'Terms of Service content would be displayed here or opened in a web view.');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>Terms of Service</Text>
            <IconSymbol size={18} name="chevron.right" color="#666666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkButton, styles.linkButtonLast]}
            onPress={() => {
              Alert.alert('Privacy Policy', 'Privacy Policy content would be displayed here or opened in a web view.');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>Privacy Policy</Text>
            <IconSymbol size={18} name="chevron.right" color="#666666" />
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>Waypool Driver App</Text>
          <Text style={styles.appInfoVersion}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(66, 133, 244, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#999999',
  },
  faqItem: {
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  faqItemLast: {
    marginBottom: 0,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 12,
    lineHeight: 22,
  },
  faqAnswer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  faqAnswerText: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  linkButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  linkButtonLast: {
    marginBottom: 0,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  appInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 4,
  },
  appInfoVersion: {
    fontSize: 12,
    color: '#666666',
  },
});

