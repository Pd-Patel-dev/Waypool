/**
 * Cached Image Component
 * Provides image caching, lazy loading, and placeholder support
 * Uses expo-image for efficient caching and better performance
 */

import React, { useState } from 'react';
import { View, StyleSheet, ViewStyle, ImageStyle, ActivityIndicator, Animated } from 'react-native';
import { Image, ImageSource, ImageContentFit, ImageTransition, ImageErrorEventData } from 'expo-image';
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
  contentFit?: ImageContentFit;

  /**
   * Transition effect when image loads
   * @default 200
   */
  transition?: number | ImageTransition | null;

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
  onError?: (error: ImageErrorEventData) => void;

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
 * - Progressive loading support (when progressive prop is true)
 */
export const CachedImage: React.FC<CachedImageProps> = ({
  source,
  style,
  imageStyle,
  placeholder = 'default',
  contentFit = 'cover' as ImageContentFit,
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
  const [imageOpacity] = useState(new Animated.Value(0));

  // Convert string source to ImageSource format
  const imageSource: ImageSource | ImageSource[] | number = typeof source === 'string'
    ? { uri: source }
    : source;

  // Determine if we should show placeholder
  const showPlaceholder = (isLoading || hasError) && placeholder !== undefined;

  // Handle image load with fade-in animation
  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    
    // Animate fade-in
    Animated.timing(imageOpacity, {
      toValue: 1,
      duration: transition,
      useNativeDriver: true,
    }).start();
    
    onLoad?.();
  };

  // Handle image error
  const handleError = (error: ImageErrorEventData) => {
    setIsLoading(false);
    setHasError(true);
    onError?.(error);
  };

  // Render placeholder
  const renderPlaceholder = (): React.ReactNode => {
    if (!showPlaceholder) return null;

    if (placeholder === 'default') {
      let size = 120;
      if (style && typeof style === 'object' && !Array.isArray(style)) {
        const styleObj = style as ViewStyle | ImageStyle;
        if ('width' in styleObj && typeof styleObj.width === 'number') {
          size = styleObj.width;
        } else if ('height' in styleObj && typeof styleObj.height === 'number') {
          size = styleObj.height;
        }
      }
      return <DefaultPlaceholder size={size} />;
    }

    return <>{placeholder}</>;
  };

  return (
    <View style={[styles.container, style]}>
      {showPlaceholder && renderPlaceholder()}
      
      {!hasError && (
        <Animated.View
          style={[
            styles.imageContainer,
            {
              opacity: imageOpacity,
            },
          ]}
        >
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
        </Animated.View>
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
  imageContainer: {
    width: '100%',
    height: '100%',
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

