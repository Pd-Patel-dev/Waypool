/**
 * Skeleton Loader Components
 * Provides animated placeholder skeletons for better perceived performance
 * Replaces spinners with content-aware loading states
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ViewStyle, Animated } from 'react-native';

interface SkeletonProps {
  /**
   * Width of the skeleton
   */
  width?: number | string;

  /**
   * Height of the skeleton
   */
  height?: number | string;

  /**
   * Border radius
   * @default 4
   */
  borderRadius?: number;

  /**
   * Custom style
   */
  style?: ViewStyle;

  /**
   * Animation duration in milliseconds
   * @default 1500
   */
  duration?: number;
}

/**
 * Base Skeleton Component
 * Animated shimmer effect
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
  duration = 1500,
}) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim, duration]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

/**
 * Skeleton Text Component
 * Multiple lines of text skeleton
 */
interface SkeletonTextProps {
  /**
   * Number of lines
   * @default 3
   */
  lines?: number;

  /**
   * Width of each line (can be array for different widths)
   */
  widths?: (number | string)[];

  /**
   * Line height
   * @default 16
   */
  lineHeight?: number;

  /**
   * Spacing between lines
   * @default 8
   */
  spacing?: number;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  widths,
  lineHeight = 16,
  spacing = 8,
}) => {
  const lineWidths = widths || Array(lines).fill('100%');
  // Last line is usually shorter
  if (!widths && lines > 1) {
    lineWidths[lines - 1] = '60%';
  }

  return (
    <View style={styles.textContainer}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={lineWidths[index] || '100%'}
          height={lineHeight}
          borderRadius={4}
          style={index < lines - 1 ? { marginBottom: spacing } : undefined}
        />
      ))}
    </View>
  );
};

/**
 * Skeleton Card Component
 * For card-like content (rides, bookings, etc.)
 */
interface SkeletonCardProps {
  /**
   * Show avatar skeleton
   * @default false
   */
  showAvatar?: boolean;

  /**
   * Number of text lines
   * @default 2
   */
  lines?: number;

  /**
   * Show action button skeleton
   * @default false
   */
  showButton?: boolean;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  showAvatar = false,
  lines = 2,
  showButton = false,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        {showAvatar && (
          <Skeleton width={48} height={48} borderRadius={24} style={styles.avatar} />
        )}
        <View style={styles.cardText}>
          <SkeletonText lines={lines} lineHeight={16} spacing={8} />
        </View>
      </View>
      {showButton && (
        <Skeleton width={80} height={36} borderRadius={8} style={styles.button} />
      )}
    </View>
  );
};

/**
 * Skeleton List Component
 * Multiple skeleton cards in a list
 */
interface SkeletonListProps {
  /**
   * Number of items
   * @default 5
   */
  count?: number;

  /**
   * Skeleton card props
   */
  cardProps?: SkeletonCardProps;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({
  count = 5,
  cardProps,
}) => {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} {...cardProps} />
      ))}
    </View>
  );
};

/**
 * Skeleton Ride Card
 * Specific skeleton for ride cards
 */
export const SkeletonRideCard: React.FC = () => {
  return (
    <View style={styles.rideCard}>
      <View style={styles.rideHeader}>
        <Skeleton width={100} height={16} borderRadius={4} />
        <Skeleton width={60} height={16} borderRadius={4} />
      </View>
      <View style={styles.rideRoute}>
        <View style={styles.routePoint}>
          <Skeleton width={12} height={12} borderRadius={6} />
          <View style={styles.routeText}>
            <Skeleton width={40} height={12} borderRadius={4} style={styles.label} />
            <Skeleton width="100%" height={16} borderRadius={4} />
          </View>
        </View>
        <Skeleton width={2} height={20} borderRadius={1} style={styles.routeLine} />
        <View style={styles.routePoint}>
          <Skeleton width={12} height={12} borderRadius={6} />
          <View style={styles.routeText}>
            <Skeleton width={40} height={12} borderRadius={4} style={styles.label} />
            <Skeleton width="100%" height={16} borderRadius={4} />
          </View>
        </View>
      </View>
      <View style={styles.rideFooter}>
        <View style={styles.stats}>
          <Skeleton width={80} height={14} borderRadius={4} />
          <Skeleton width={60} height={14} borderRadius={4} />
        </View>
        <Skeleton width={100} height={20} borderRadius={4} />
      </View>
    </View>
  );
};

/**
 * Skeleton Ride List
 * Multiple ride card skeletons
 */
export const SkeletonRideList: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <View style={styles.rideList}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonRideCard key={index} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#2A2A2A',
  },
  textContainer: {
    flex: 1,
  },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    marginRight: 12,
  },
  cardText: {
    flex: 1,
  },
  button: {
    marginLeft: 12,
  },
  list: {
    padding: 16,
  },
  rideCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rideRoute: {
    marginBottom: 16,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeText: {
    flex: 1,
    marginLeft: 12,
  },
  label: {
    marginBottom: 4,
  },
  routeLine: {
    marginLeft: 5,
    marginVertical: 4,
  },
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  stats: {
    flexDirection: 'row',
    gap: 12,
  },
  rideList: {
    padding: 16,
  },
});

