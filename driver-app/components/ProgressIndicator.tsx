/**
 * Progress Indicator Component
 * Shows progress for long-running operations (file uploads, data sync)
 */

import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { IconSymbol } from './ui/icon-symbol';

export interface ProgressIndicatorProps {
  /**
   * Progress value (0-1)
   */
  progress: number;

  /**
   * Optional message to display
   */
  message?: string;

  /**
   * Show percentage
   * @default true
   */
  showPercentage?: boolean;

  /**
   * Height of the progress bar
   * @default 4
   */
  height?: number;

  /**
   * Color of the progress bar
   * @default '#4285F4'
   */
  color?: string;

  /**
   * Background color
   * @default '#2A2A2A'
   */
  backgroundColor?: string;

  /**
   * Show animated progress
   * @default true
   */
  animated?: boolean;

  /**
   * Custom style
   */
  style?: View['props']['style'];
}

/**
 * Progress Indicator Component
 * 
 * @example
 * ```typescript
 * <ProgressIndicator
 *   progress={0.65}
 *   message="Uploading image..."
 *   showPercentage={true}
 * />
 * ```
 */
export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress,
  message,
  showPercentage = true,
  height = 4,
  color = '#4285F4',
  backgroundColor = '#2A2A2A',
  animated = true,
  style,
}) => {
  const [animatedProgress] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    if (animated) {
      Animated.timing(animatedProgress, {
        toValue: progress,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      animatedProgress.setValue(progress);
    }
  }, [progress, animated, animatedProgress]);

  const width = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const percentage = Math.round(progress * 100);

  return (
    <View style={[styles.container, style]}>
      {message && (
        <View style={styles.messageContainer}>
          <Text style={styles.message}>{message}</Text>
          {showPercentage && (
            <Text style={styles.percentage}>{percentage}%</Text>
          )}
        </View>
      )}
      <View style={[styles.track, { height, backgroundColor }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              width,
              height,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
};

/**
 * Circular Progress Indicator
 * For smaller spaces or inline use
 */
export interface CircularProgressProps {
  /**
   * Progress value (0-1)
   */
  progress: number;

  /**
   * Size of the circle
   * @default 40
   */
  size?: number;

  /**
   * Stroke width
   * @default 4
   */
  strokeWidth?: number;

  /**
   * Color of the progress
   * @default '#4285F4'
   */
  color?: string;

  /**
   * Background color
   * @default '#2A2A2A'
   */
  backgroundColor?: string;

  /**
   * Show percentage text
   * @default false
   */
  showPercentage?: boolean;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size = 40,
  strokeWidth = 4,
  color = '#4285F4',
  backgroundColor = '#2A2A2A',
  showPercentage = false,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={[styles.circularContainer, { width: size, height: size }]}>
      {showPercentage && (
        <Text style={[styles.circularPercentage, { fontSize: size * 0.25 }]}>
          {Math.round(progress * 100)}%
        </Text>
      )}
      {/* Note: For a true circular progress, you'd need react-native-svg
          This is a simplified version using a square with rounded corners */}
      <View
        style={[
          styles.circularTrack,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: backgroundColor,
          },
        ]}
      />
    </View>
  );
};

/**
 * Upload Progress Component
 * Specialized component for file uploads with status
 */
export interface UploadProgressProps {
  /**
   * Progress value (0-1)
   */
  progress: number;

  /**
   * Upload status
   */
  status: 'uploading' | 'processing' | 'complete' | 'error';

  /**
   * File name
   */
  fileName?: string;

  /**
   * Error message (if status is 'error')
   */
  errorMessage?: string;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({
  progress,
  status,
  fileName,
  errorMessage,
}) => {
  const getStatusMessage = () => {
    switch (status) {
      case 'uploading':
        return 'Uploading...';
      case 'processing':
        return 'Processing...';
      case 'complete':
        return 'Upload complete';
      case 'error':
        return errorMessage || 'Upload failed';
      default:
        return '';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'complete':
        return 'checkmark.circle.fill';
      case 'error':
        return 'xmark.circle.fill';
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'complete':
        return '#34C759';
      case 'error':
        return '#FF3B30';
      default:
        return '#4285F4';
    }
  };

  return (
    <View style={styles.uploadContainer}>
      {fileName && (
        <View style={styles.uploadHeader}>
          <Text style={styles.fileName} numberOfLines={1}>
            {fileName}
          </Text>
          {getStatusIcon() && (
            <IconSymbol
              name={getStatusIcon()!}
              size={20}
              color={getStatusColor()}
            />
          )}
        </View>
      )}
      <ProgressIndicator
        progress={status === 'complete' ? 1 : progress}
        message={getStatusMessage()}
        showPercentage={status === 'uploading'}
        color={getStatusColor()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  messageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  percentage: {
    fontSize: 14,
    color: '#999999',
    fontWeight: '600',
  },
  track: {
    width: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 2,
  },
  circularContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularTrack: {
    position: 'absolute',
  },
  circularPercentage: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  uploadContainer: {
    width: '100%',
    padding: 12,
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
  },
  uploadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fileName: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
});

