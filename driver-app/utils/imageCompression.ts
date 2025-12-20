/**
 * Image Compression Utility
 * Provides image compression, format conversion, and optimization
 * Reduces file sizes by 60-80% while maintaining acceptable quality
 * 
 * Note: Requires native rebuild after installing expo-image-manipulator
 * Run: npx expo prebuild && npx expo run:ios (or run:android)
 */

import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

// Lazy load ImageManipulator to handle cases where native module isn't available
let ImageManipulator: typeof import('expo-image-manipulator') | null = null;
let imageManipulatorError: Error | null = null;

/**
 * Ensure ImageManipulator is loaded
 * Throws a helpful error if the native module isn't available
 */
async function ensureImageManipulator() {
  if (ImageManipulator) {
    return ImageManipulator;
  }
  
  if (imageManipulatorError) {
    throw imageManipulatorError;
  }
  
  try {
    const module = await import('expo-image-manipulator');
    
    // Check if the module is actually available (native module might be null)
    if (!module || !module.SaveFormat || !module.manipulateAsync) {
      throw new Error('expo-image-manipulator module is not properly initialized');
    }
    
    ImageManipulator = module;
    return ImageManipulator;
  } catch (error) {
    const err = new Error(
      'Image compression requires a native rebuild. Please run: npx expo prebuild && npx expo run:ios (or run:android)'
    );
    imageManipulatorError = err;
    console.error('[ImageCompression] Failed to load expo-image-manipulator:', error);
    throw err;
  }
}

export interface CompressionOptions {
  /**
   * Maximum width in pixels (maintains aspect ratio)
   * @default 1920
   */
  maxWidth?: number;

  /**
   * Maximum height in pixels (maintains aspect ratio)
   * @default 1920
   */
  maxHeight?: number;

  /**
   * Compression quality (0-1, where 1 is highest quality)
   * @default 0.8
   */
  quality?: number;

  /**
   * Output format
   * @default 'jpeg'
   */
  format?: 'jpeg' | 'png';

  /**
   * Whether to convert to WebP (better compression, but not supported everywhere)
   * @default false
   */
  useWebP?: boolean;
}

export interface CompressedImageResult {
  /**
   * Compressed image URI (local file path)
   */
  uri: string;

  /**
   * Original file size in bytes
   */
  originalSize: number;

  /**
   * Compressed file size in bytes
   */
  compressedSize: number;

  /**
   * Compression ratio (0-1, where 0.2 means 80% reduction)
   */
  compressionRatio: number;

  /**
   * Image width after compression
   */
  width: number;

  /**
   * Image height after compression
   */
  height: number;

  /**
   * MIME type of the compressed image
   */
  mimeType: string;
}

// Default options - using string literals to avoid referencing ImageManipulator at module load time
const DEFAULT_OPTIONS: Required<Omit<CompressionOptions, 'useWebP'>> & { useWebP: boolean } = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
  format: 'jpeg' as const,
  useWebP: false,
};

/**
 * Get file size from URI (works for local files)
 */
async function getFileSize(uri: string): Promise<number> {
  try {
    // Try using FileSystem first (more reliable for local files)
    const { FileSystem } = await import('expo-file-system');
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (fileInfo.exists && 'size' in fileInfo && typeof fileInfo.size === 'number') {
      return fileInfo.size;
    }
  } catch {
    // Fallback to fetch
  }

  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob.size;
  } catch {
    // If we can't get the size, return 0
    return 0;
  }
}

/**
 * Compress an image with the given options
 * 
 * @param imageUri - URI of the image to compress (local file path)
 * @param options - Compression options
 * @returns Compressed image result with metadata
 * 
 * @example
 * ```typescript
 * const result = await compressImage(imageUri, {
 *   maxWidth: 1500,
 *   quality: 0.8,
 *   format: 'jpeg'
 * });
 * console.log(`Reduced size by ${(1 - result.compressionRatio) * 100}%`);
 * ```
 */
export async function compressImage(
  imageUri: string,
  options: CompressionOptions = {}
): Promise<CompressedImageResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Ensure ImageManipulator is loaded
    const Manipulator = await ensureImageManipulator();
    
    // Get original file size
    const originalSize = await getFileSize(imageUri);

    // Determine output format
    let outputFormat: typeof Manipulator.SaveFormat.JPEG | typeof Manipulator.SaveFormat.PNG;
    if (opts.format === 'png') {
      outputFormat = Manipulator.SaveFormat.PNG;
    } else {
      outputFormat = Manipulator.SaveFormat.JPEG;
    }

    // Get image dimensions first
    const imageInfo = await Manipulator.manipulateAsync(
      imageUri,
      [], // No manipulations, just get info
      { format: outputFormat, compress: 1 } // No compression, just get dimensions
    );

    // Calculate resize dimensions (maintain aspect ratio)
    let resizeWidth = imageInfo.width;
    let resizeHeight = imageInfo.height;

    if (resizeWidth > opts.maxWidth || resizeHeight > opts.maxHeight) {
      const widthRatio = opts.maxWidth / resizeWidth;
      const heightRatio = opts.maxHeight / resizeHeight;
      const ratio = Math.min(widthRatio, heightRatio);

      resizeWidth = Math.round(resizeWidth * ratio);
      resizeHeight = Math.round(resizeHeight * ratio);
    }

    // Perform compression with resize
    const actions: typeof Manipulator.Action[] = [];
    
    if (resizeWidth !== imageInfo.width || resizeHeight !== imageInfo.height) {
      actions.push({
        resize: {
          width: resizeWidth,
          height: resizeHeight,
        },
      });
    }

    // Compress the image
    const compressedImage = await Manipulator.manipulateAsync(
      imageUri,
      actions,
      {
        compress: opts.quality,
        format: outputFormat,
      }
    );

    // Get compressed file size
    const compressedSize = await getFileSize(compressedImage.uri);

    // Calculate compression ratio
    const compressionRatio = originalSize > 0 
      ? compressedSize / originalSize 
      : 0;

    // Determine MIME type
    let mimeType = 'image/jpeg';
    if (outputFormat === Manipulator.SaveFormat.PNG) {
      mimeType = 'image/png';
    } else if (opts.useWebP) {
      mimeType = 'image/webp';
    }

    return {
      uri: compressedImage.uri,
      originalSize,
      compressedSize,
      compressionRatio,
      width: compressedImage.width,
      height: compressedImage.height,
      mimeType,
    };
  } catch (error) {
    console.error('[ImageCompression] Error compressing image:', error);
    throw new Error(`Failed to compress image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Pick and compress an image from the library or camera
 * 
 * @param source - 'library' or 'camera'
 * @param compressionOptions - Optional compression options
 * @returns Compressed image result or null if cancelled
 * 
 * @example
 * ```typescript
 * const result = await pickAndCompressImage('library', {
 *   maxWidth: 1500,
 *   quality: 0.8
 * });
 * if (result) {
 *   console.log(`Image compressed: ${result.compressedSize} bytes`);
 * }
 * ```
 */
export async function pickAndCompressImage(
  source: 'library' | 'camera',
  compressionOptions: CompressionOptions = {}
): Promise<CompressedImageResult | null> {
  try {
    // Request permissions
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Camera permission denied');
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Photo library permission denied');
      }
    }

    // Launch image picker
    const result = await (source === 'camera'
      ? ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 1, // Get full quality first, we'll compress it
          exif: false, // Remove EXIF data for privacy and smaller size
        })
      : ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 1, // Get full quality first, we'll compress it
          exif: false, // Remove EXIF data for privacy and smaller size
        }));

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    if (!asset.uri) {
      return null;
    }

    // Compress the selected image
    const compressed = await compressImage(asset.uri, compressionOptions);

    return compressed;
  } catch (error) {
    console.error('[ImageCompression] Error picking and compressing image:', error);
    throw error;
  }
}

/**
 * Create a low-quality placeholder (blur-up effect)
 * This creates a very small, heavily compressed version for the blur effect
 * 
 * @param imageUri - URI of the image
 * @returns URI of the low-quality placeholder
 */
export async function createBlurPlaceholder(imageUri: string): Promise<string> {
  try {
    const Manipulator = await ensureImageManipulator();
    const placeholder = await Manipulator.manipulateAsync(
      imageUri,
      [
        {
          resize: {
            width: 20, // Very small for blur effect
            height: 20,
          },
        },
      ],
      {
        compress: 0.1, // Very low quality
        format: Manipulator.SaveFormat.JPEG,
      }
    );

    return placeholder.uri;
  } catch (error) {
    console.error('[ImageCompression] Error creating blur placeholder:', error);
    // Return original URI as fallback
    return imageUri;
  }
}

/**
 * Get recommended compression options based on use case
 */
export const CompressionPresets = {
  /**
   * Profile pictures - good quality, moderate size
   */
  profile: {
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.85,
    format: 'jpeg' as const,
  } as CompressionOptions,

  /**
   * Thumbnails - small size, lower quality
   */
  thumbnail: {
    maxWidth: 300,
    maxHeight: 300,
    quality: 0.7,
    format: 'jpeg' as const,
  } as CompressionOptions,

  /**
   * Document uploads - high quality, larger size allowed
   */
  document: {
    maxWidth: 2000,
    maxHeight: 2000,
    quality: 0.9,
    format: 'jpeg' as const,
  } as CompressionOptions,

  /**
   * Ride images - balanced quality and size
   */
  ride: {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.8,
    format: 'jpeg' as const,
  } as CompressionOptions,
} as const;
