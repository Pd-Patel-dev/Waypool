/**
 * Image Upload Service
 * Handles image uploads with compression and progress tracking
 */

import { compressImage, CompressionPresets, type CompressionOptions } from '@/utils/imageCompression';
import { API_BASE_URL } from '@/config/api';
import { getUserFriendlyErrorMessage } from '@/utils/errorHandler';
import type { UploadProgress } from './imageUpload';

export interface UploadProgress {
  /**
   * Upload progress (0-1)
   */
  progress: number;

  /**
   * Bytes uploaded
   */
  bytesUploaded: number;

  /**
   * Total bytes to upload
   */
  totalBytes: number;
}

export interface UploadResult {
  /**
   * URL of the uploaded image
   */
  url: string;

  /**
   * Original file size in bytes
   */
  originalSize: number;

  /**
   * Compressed file size in bytes
   */
  compressedSize: number;

  /**
   * Compression ratio
   */
  compressionRatio: number;
}

/**
 * Upload an image with compression
 * 
 * @param imageUri - Local file URI of the image
 * @param endpoint - API endpoint to upload to
 * @param fieldName - Form field name for the file
 * @param compressionOptions - Optional compression options (defaults to profile preset)
 * @param onProgress - Optional progress callback
 * @param token - Optional authentication token
 * @returns Upload result with image URL
 * 
 * @example
 * ```typescript
 * const result = await uploadImage(
 *   imageUri,
 *   '/api/driver/profile/photo',
 *   'photo',
 *   CompressionPresets.profile,
 *   (progress) => console.log(`Upload: ${progress.progress * 100}%`)
 * );
 * console.log(`Image uploaded: ${result.url}`);
 * ```
 */
export async function uploadImage(
  imageUri: string,
  endpoint: string,
  fieldName: string = 'image',
  compressionOptions: CompressionOptions = CompressionPresets.profile,
  onProgress?: (progress: UploadProgress) => void,
  token?: string
): Promise<UploadResult> {
  try {
    // Step 1: Compress the image
    console.log('[ImageUpload] Compressing image...');
    const compressed = await compressImage(imageUri, compressionOptions);
    
    console.log(
      `[ImageUpload] Compression complete: ${compressed.originalSize} → ${compressed.compressedSize} bytes ` +
      `(${((1 - compressed.compressionRatio) * 100).toFixed(1)}% reduction)`
    );

    // Step 2: Create FormData
    const formData = new FormData();
    
    // Extract filename from URI
    const filename = imageUri.split('/').pop() || 'image.jpg';
    const fileExtension = filename.split('.').pop() || 'jpg';
    const mimeType = compressed.mimeType || `image/${fileExtension}`;

    // Append file to FormData
    formData.append(fieldName, {
      uri: compressed.uri,
      type: mimeType,
      name: filename,
    } as any);

    // Step 3: Upload with progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            onProgress({
              progress: event.loaded / event.total,
              bytesUploaded: event.loaded,
              totalBytes: event.total,
            });
          }
        });
      }

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve({
              url: response.url || response.data?.url || response.imageUrl || '',
              originalSize: compressed.originalSize,
              compressedSize: compressed.compressedSize,
              compressionRatio: compressed.compressionRatio,
            });
          } catch (error) {
            reject(new Error('Failed to parse upload response'));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload was aborted'));
      });

      // Start upload
      xhr.open('POST', `${API_BASE_URL}${endpoint}`);
      
      // Add authentication header if token provided
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      // Send request
      xhr.send(formData);
    });
  } catch (error) {
    const errorMessage = getUserFriendlyErrorMessage(error);
    console.error('[ImageUpload] Upload failed:', errorMessage);
    throw new Error(`Image upload failed: ${errorMessage}`);
  }
}

/**
 * Upload profile photo
 * Convenience function for uploading profile pictures
 */
export async function uploadProfilePhoto(
  imageUri: string,
  onProgress?: (progress: UploadProgress) => void,
  token?: string
): Promise<UploadResult> {
  return uploadImage(
    imageUri,
    '/api/driver/profile/photo',
    'photo',
    CompressionPresets.profile,
    onProgress,
    token
  );
}

