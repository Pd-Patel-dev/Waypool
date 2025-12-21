import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import Constants from 'expo-constants';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, CARDS, RESPONSIVE_SPACING } from '@/constants/designSystem';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: '1',
    question: 'How do I book a ride?',
    answer: 'Browse available rides on the home screen, select a ride that matches your destination, choose your pickup location, and confirm your booking with payment.',
  },
  {
    id: '2',
    question: 'Can I cancel my booking?',
    answer: 'Yes, you can cancel your booking from the home screen if the ride hasn\'t started yet. Cancellation policies may apply.',
  },
  {
    id: '3',
    question: 'How do I pay for a ride?',
    answer: 'We accept credit/debit cards saved to your account, as well as Apple Pay and Google Pay. Payment is authorized when you book and charged when the ride is completed.',
  },
  {
    id: '4',
    question: 'What if the driver doesn\'t show up?',
    answer: 'Contact support immediately if your driver doesn\'t arrive. We\'ll help you find an alternative or process a refund if necessary.',
  },
  {
    id: '5',
    question: 'How do I save my home and work addresses?',
    answer: 'Go to Menu > Saved Addresses and add your frequently used locations. You can label them as Home, Work, or custom labels for quick access when booking.',
  },
  {
    id: '6',
    question: 'Is my payment information secure?',
    answer: 'Yes, all payment information is securely processed through Stripe. We never store your full card details on our servers.',
  },
];

export default function HelpSupportScreen(): React.JSX.Element {
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const handleContactSupport = () => {
    const email = 'support@waypool.com';
    const subject = 'Support Request';
    const body = '';
    
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    Linking.canOpenURL(mailtoUrl).then((supported) => {
      if (supported) {
        Linking.openURL(mailtoUrl);
      } else {
        Alert.alert(
          'Email Not Available',
          'Please contact us at support@waypool.com',
          [{ text: 'OK' }]
        );
      }
    });
  };

  const handleReportProblem = () => {
    const email = 'support@waypool.com';
    const subject = 'Problem Report';
    const body = 'Please describe the problem you encountered:\n\n';
    
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    Linking.canOpenURL(mailtoUrl).then((supported) => {
      if (supported) {
        Linking.openURL(mailtoUrl);
      } else {
        Alert.alert(
          'Email Not Available',
          'Please email us at support@waypool.com with details about the problem.',
          [{ text: 'OK' }]
        );
      }
    });
  };

  const handleOpenLink = (url: string, title: string) => {
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert(
          'Unable to Open',
          `Please visit ${url} in your browser`,
          [{ text: 'OK' }]
        );
      }
    });
  };

  const appVersion = Constants.expoConfig?.version || '1.0.0';

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
          <IconSymbol name="chevron.left" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <View style={styles.faqContainer}>
            {FAQ_DATA.map((faq) => (
              <View key={faq.id} style={styles.faqItem}>
                <TouchableOpacity
                  style={styles.faqQuestion}
                  onPress={() => toggleFAQ(faq.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.faqQuestionText}>{faq.question}</Text>
                  <IconSymbol
                    name={expandedFAQ === faq.id ? 'chevron.up' : 'chevron.down'}
                    size={18}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
                {expandedFAQ === faq.id && (
                  <View style={styles.faqAnswer}>
                    <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Support Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Get Help</Text>
          
          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleContactSupport}
            activeOpacity={0.7}
          >
            <View style={styles.actionIconContainer}>
              <IconSymbol name="envelope.fill" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Contact Support</Text>
              <Text style={styles.actionDescription}>Email us for assistance</Text>
            </View>
            <IconSymbol name="chevron.right" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleReportProblem}
            activeOpacity={0.7}
          >
            <View style={styles.actionIconContainer}>
              <IconSymbol name="exclamationmark.triangle.fill" size={24} color={COLORS.warning} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Report a Problem</Text>
              <Text style={styles.actionDescription}>Let us know about issues</Text>
            </View>
            <IconSymbol name="chevron.right" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Legal Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          
          <TouchableOpacity
            style={styles.legalItem}
            onPress={() => handleOpenLink('https://waypool.com/terms', 'Terms & Conditions')}
            activeOpacity={0.7}
          >
            <Text style={styles.legalText}>Terms & Conditions</Text>
            <IconSymbol name="chevron.right" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <View style={styles.legalDivider} />

          <TouchableOpacity
            style={styles.legalItem}
            onPress={() => handleOpenLink('https://waypool.com/privacy', 'Privacy Policy')}
            activeOpacity={0.7}
          >
            <Text style={styles.legalText}>Privacy Policy</Text>
            <IconSymbol name="chevron.right" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version {appVersion}</Text>
          <Text style={styles.versionSubtext}>Waypool Rider App</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: RESPONSIVE_SPACING.padding,
    paddingTop: SPACING.base,
    paddingBottom: SPACING.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: RESPONSIVE_SPACING.padding,
    paddingTop: SPACING.base * 1.5,
    paddingBottom: SPACING.xl,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.base,
  },
  faqContainer: {
    gap: SPACING.sm,
  },
  faqItem: {
    ...CARDS.default,
    padding: 0,
    overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.base,
    gap: SPACING.sm,
  },
  faqQuestionText: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
  },
  faqAnswer: {
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING.base,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  faqAnswerText: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    paddingTop: SPACING.sm,
  },
  actionCard: {
    ...CARDS.default,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.base,
    marginBottom: SPACING.base,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primaryTint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  actionDescription: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  legalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.base,
  },
  legalDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  legalText: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    marginTop: SPACING.base,
  },
  versionText: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  versionSubtext: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: COLORS.textTertiary,
  },
});

