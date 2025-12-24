/**
 * Pricing Breakdown Component
 * Extracted from booking-confirm.tsx for better code organization
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '@/constants/designSystem';

interface PricingBreakdownProps {
  subtotal: number;
  processingFee: number;
  platformCommission: number;
  total: number;
}

export default function PricingBreakdown({
  subtotal,
  processingFee,
  platformCommission,
  total,
}: PricingBreakdownProps): React.JSX.Element {
  return (
    <View style={styles.pricingBreakdown}>
      <View style={styles.pricingRow}>
        <Text style={styles.pricingLabel}>Subtotal</Text>
        <Text style={styles.pricingValue}>${subtotal.toFixed(2)}</Text>
      </View>
      <View style={styles.pricingRow}>
        <Text style={styles.pricingLabel}>Processing Fee</Text>
        <Text style={styles.pricingValue}>${processingFee.toFixed(2)}</Text>
      </View>
      <View style={styles.pricingRow}>
        <Text style={styles.pricingLabel}>Platform Fee</Text>
        <Text style={styles.pricingValue}>${platformCommission.toFixed(2)}</Text>
      </View>
      <View style={styles.pricingDivider} />
      <View style={styles.pricingRow}>
        <Text style={styles.pricingTotalLabel}>Total</Text>
        <Text style={styles.pricingTotalValue}>${total.toFixed(2)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pricingBreakdown: {
    marginTop: SPACING.base,
    paddingTop: SPACING.base,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  pricingLabel: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  pricingValue: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  pricingDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.base,
  },
  pricingTotalLabel: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  pricingTotalValue: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
});

