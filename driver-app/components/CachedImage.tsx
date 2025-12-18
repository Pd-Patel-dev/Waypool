/**
 * Cached Image Component
 * Provides image caching, lazy loading, and placeholder support
 * Uses expo-image for efficient caching and better performance
 */

import React, { useState } from 'react';
import { View, StyleSheet, ViewStyle, ImageStyle, ActivityIndicator } from 'react-native';
import { Image, ImageSource } from 'expo-image';
import { IconSymbol } from './ui/icon-symbol';

interface CachedImageProps {
  /**
   * Image source - can be a URL string, local require, or ImageSource
   */
  source: string | number | ImageSource | ImageSource[];

  /**
   * Style for the image container
   */
  style?: ViewStyle | ImageStyle;

  /**
   * Style for the image itself (will be merged with style)
   */
  imageStyle?: ImageStyle;

  /**
   * Placeholder to show while loading
   * Can be a component or 'default' for default placeholder
   */
  placeholder?: React.ReactNode | 'default';

  /**
   * Content fit mode for the image
   * @default 'cover'
   */
  contentFit?: 'contain' | 'cover' | 'fill' | 'scaleDown' | 'none';

  /**
   * Transition effect when image loads
   * @default true
   */
  transition?: number | boolean;

  /**
   * Priority for image loading
   * 'low' - load when other images are done
   * 'normal' - normal priority
   * 'high' - load immediately
   * @default 'normal'
   */
  priority?: 'low' | 'normal' | 'high';

  /**
   * Cache policy
   * 'none' - Don't cache
   * 'disk' - Cache to disk (default)
   * 'memory' - Cache to memory only
   * @default 'disk'
   */
  cachePolicy?: 'none' | 'disk' | 'memory';

  /**
   * Enable lazy loading (only load when near viewport)
   * @default false
   */
  lazy?: boolean;

  /**
   * Callback when image loads successfully
   */
  onLoad?: () => void;

  /**
   * Callback when image fails to load
   */
  onError?: (error: Error) => void;

  /**
   * Accessibility label
   */
  accessibilityLabel?: string;

  /**
   * Show loading indicator
   * @default true
   */
  showLoadingIndicator?: boolean;
}

/**
 * Default placeholder component
 */
const DefaultPlaceholder: React.FC<{ size?: number }> = ({ size = 120 }) => (
  <View style={[styles.placeholderContainer, { width: size, height: size }]}>
    <IconSymbol name="person.circle.fill" size={size * 0.6} color="#666666" />
  </View>
);

/**
 * CachedImage Component
 * 
 * Features:
 * - Automatic disk caching via expo-image
 * - Lazy loading support
 * - Placeholder support
 * - Loading indicators
 * - Error handling
 */
export const CachedImage: React.FC<CachedImageProps> = ({
  source,
  style,
  imageStyle,
  placeholder = 'default',
  contentFit = 'cover',
  transition = 200,
  priority = 'normal',
  cachePolicy = 'disk',
  lazy = false,
  onLoad,
  onError,
  accessibilityLabel,
  showLoadingIndicator = true,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Convert string source to ImageSource format
  const imageSource: ImageSource = typeof source === 'string'
    ? { uri: source, priority, cachePolicy }
    : typeof source === 'number'
    ? source
    : source;

  // Determine if we should show placeholder
  const showPlaceholder = (isLoading || hasError) && placeholder !== undefined;

  // Handle image load
  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  // Handle image error
  const handleError = (error: Error) => {
    setIsLoading(false);
    setHasError(true);
    onError?.(error);
  };

  // Render placeholder
  const renderPlaceholder = () => {
    if (!showPlaceholder) return null;

    if (placeholder === 'default') {
      const size = (style && 'width' in style && typeof style.width === 'number')
        ? style.width
        : (style && 'height' in style && typeof style.height === 'number')
        ? style.height
        : 120;
      return <DefaultPlaceholder size={size as number} />;
    }

    return <>{placeholder}</>;
  };

  return (
    <View style={[styles.container, style]}>
      {showPlaceholder && renderPlaceholder()}
      
      {!hasError && (
        <Image
          source={imageSource}
          style={[
            styles.image,
            imageStyle,
            showPlaceholder && styles.imageHidden,
            !isLoading && !hasError && styles.imageVisible,
          ]}
          contentFit={contentFit}
          transition={transition}
          priority={priority}
          cachePolicy={cachePolicy}
          onLoad={handleLoad}
          onError={handleError}
          accessibilityLabel={accessibilityLabel}
        />
      )}

      {isLoading && showLoadingIndicator && !showPlaceholder && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#4285F4" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageHidden: {
    opacity: 0,
    position: 'absolute',
  },
  imageVisible: {
    opacity: 1,
  },
  placeholderContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#2A2A2A',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
  },
});

/**
 * LazyImage Component
 * Wrapper around CachedImage with lazy loading enabled by default
 */
export const LazyImage: React.FC<Omit<CachedImageProps, 'lazy'>> = (props) => (
  <CachedImage {...props} lazy={true} />
);

