/**
 * Progressive Image Component
 * Implements progressive image loading with blur-up effect
 * Shows a low-quality placeholder that gradually transitions to the full image
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ViewStyle, ImageStyle, Animated } from 'react-native';
import { Image, ImageSource, ImageContentFit, ImageTransition } from 'expo-image';
import { CachedImage } from './CachedImage';
import { createBlurPlaceholder } from '@/utils/imageCompression';

interface ProgressiveImageProps {
  /**
   * Image source - can be a URL string, local require, or ImageSource
   */
  source: string | number | ImageSource | ImageSource[];

  /**
   * Style for the image container
   */
  style?: ViewStyle | ImageStyle;

  /**
   * Style for the image itself
   */
  imageStyle?: ImageStyle;

  /**
   * Content fit mode for the image
   * @default 'cover'
   */
  contentFit?: ImageContentFit;

  /**
   * Transition duration in milliseconds
   * @default 300
   */
  transitionDuration?: number;

  /**
   * Whether to enable blur-up effect
   * @default true
   */
  enableBlurUp?: boolean;

  /**
   * Placeholder to show while loading
   */
  placeholder?: React.ReactNode;

  /**
   * Priority for image loading
   * @default 'normal'
   */
  priority?: 'low' | 'normal' | 'high';

  /**
   * Cache policy
   * @default 'disk'
   */
  cachePolicy?: 'none' | 'disk' | 'memory';

  /**
   * Callback when image loads successfully
   */
  onLoad?: () => void;

  /**
   * Callback when image fails to load
   */
  onError?: (error: any) => void;

  /**
   * Accessibility label
   */
  accessibilityLabel?: string;
}

/**
 * ProgressiveImage Component
 * 
 * Features:
 * - Progressive loading: Shows low-quality placeholder first
 * - Blur-up effect: Smooth transition from placeholder to full image
 * - Automatic placeholder generation
 * - Smooth fade-in animation
 */
export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  source,
  style,
  imageStyle,
  contentFit = 'cover',
  transitionDuration = 300,
  enableBlurUp = true,
  placeholder,
  priority = 'normal',
  cachePolicy = 'disk',
  onLoad,
  onError,
  accessibilityLabel,
}) => {
  const [blurPlaceholderUri, setBlurPlaceholderUri] = useState<string | null>(null);
  const [isMainImageLoaded, setIsMainImageLoaded] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  // Generate blur placeholder if source is a string URI and blur-up is enabled
  useEffect(() => {
    if (enableBlurUp && typeof source === 'string' && source.startsWith('file://')) {
      createBlurPlaceholder(source)
        .then((uri) => {
          setBlurPlaceholderUri(uri);
        })
        .catch((error) => {
          console.warn('[ProgressiveImage] Failed to create blur placeholder:', error);
        });
    }
  }, [source, enableBlurUp]);

  // Handle main image load
  const handleMainImageLoad = () => {
    setIsMainImageLoaded(true);
    onLoad?.();

    // Animate fade-in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: transitionDuration,
      useNativeDriver: true,
    }).start();
  };

  // Convert source to ImageSource format
  const imageSource: ImageSource | ImageSource[] | number = typeof source === 'string'
    ? { uri: source }
    : source;

  // Show placeholder if main image hasn't loaded
  const showPlaceholder = !isMainImageLoaded && (blurPlaceholderUri || placeholder);

  return (
    <View style={[styles.container, style]}>
      {/* Blur placeholder (low-quality version) */}
      {showPlaceholder && blurPlaceholderUri && (
        <Image
          source={{ uri: blurPlaceholderUri }}
          style={[styles.image, styles.placeholderImage, imageStyle]}
          contentFit={contentFit}
          cachePolicy={cachePolicy}
          accessibilityLabel={accessibilityLabel ? `${accessibilityLabel} (loading)` : undefined}
        />
      )}

      {/* Custom placeholder */}
      {showPlaceholder && !blurPlaceholderUri && placeholder && (
        <View style={[styles.image, styles.placeholderContainer]}>
          {placeholder}
        </View>
      )}

      {/* Main image (full quality) */}
      <Animated.View
        style={[
          styles.imageContainer,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <Image
          source={imageSource}
          style={[styles.image, imageStyle]}
          contentFit={contentFit}
          priority={priority}
          cachePolicy={cachePolicy}
          transition={transitionDuration}
          onLoad={handleMainImageLoad}
          onError={onError}
          accessibilityLabel={accessibilityLabel}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Apply blur effect (CSS filter equivalent)
    // Note: React Native doesn't support CSS blur, but expo-image handles this
  },
  placeholderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

/**
 * Simple Progressive Image (without blur-up)
 * Falls back to regular CachedImage if blur-up is not needed
 */
export const SimpleProgressiveImage: React.FC<Omit<ProgressiveImageProps, 'enableBlurUp'>> = (props) => (
  <ProgressiveImage {...props} enableBlurUp={false} />
);

