/**
 * Standardized Loading Screen Component
 * Provides consistent loading UI across the entire app
 */

import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

interface LoadingScreenProps {
  /**
   * Optional loading message to display
   */
  message?: string;

  /**
   * Size of the activity indicator
   * @default 'large'
   */
  size?: 'small' | 'large';

  /**
   * Color of the activity indicator
   * @default '#4285F4'
   */
  color?: string;

  /**
   * Whether to show safe area insets
   * @default true
   */
  safeArea?: boolean;
}

/**
 * Standardized Loading Screen
 * Use this component when a full screen needs to show loading state
 */
export function LoadingScreen({
  message = 'Loading...',
  size = 'large',
  color = '#4285F4',
  safeArea = true,
}: LoadingScreenProps): React.JSX.Element {
  const content = (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.content}>
        <ActivityIndicator size={size} color={color} />
        {message && <Text style={styles.message}>{message}</Text>}
      </View>
    </View>
  );

  if (safeArea) {
    return <SafeAreaView style={styles.safeArea}>{content}</SafeAreaView>;
  }

  return content;
}

/**
 * Inline Loading Indicator
 * Use this component for loading states within a screen (not full screen)
 */
interface InlineLoaderProps {
  /**
   * Size of the activity indicator
   * @default 'small'
   */
  size?: 'small' | 'large';

  /**
   * Color of the activity indicator
   * @default '#4285F4'
   */
  color?: string;

  /**
   * Optional message to display
   */
  message?: string;

  /**
   * Style for the container
   */
  style?: View['props']['style'];
}

export function InlineLoader({
  size = 'small',
  color = '#4285F4',
  message,
  style,
}: InlineLoaderProps): React.JSX.Element {
  return (
    <View style={[styles.inlineContainer, style]}>
      <ActivityIndicator size={size} color={color} />
      {message && <Text style={styles.inlineMessage}>{message}</Text>}
    </View>
  );
}

/**
 * Loading Overlay
 * Use this component to show loading state over existing content
 */
interface LoadingOverlayProps {
  /**
   * Whether to show the overlay
   */
  visible: boolean;

  /**
   * Optional message to display
   */
  message?: string;

  /**
   * Size of the activity indicator
   * @default 'large'
   */
  size?: 'small' | 'large';

  /**
   * Color of the activity indicator
   * @default '#4285F4'
   */
  color?: string;
}

export function LoadingOverlay({
  visible,
  message,
  size = 'large',
  color = '#4285F4',
}: LoadingOverlayProps): React.JSX.Element | null {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.overlayContent}>
        <ActivityIndicator size={size} color={color} />
        {message && <Text style={styles.overlayMessage}>{message}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  inlineMessage: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  overlayContent: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    minWidth: 120,
  },
  overlayMessage: {
    marginTop: 12,
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

