/**
 * Payout Setup - Document Upload Screen
 * Robust ID upload flow with proper permissions and error handling
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { compressImage, CompressionPresets } from "@/utils/imageCompression";
import { ProgressIndicator, UploadProgress } from "@/components/ProgressIndicator";
import { HapticFeedback } from "@/utils/haptics";
import { useUser } from "@/context/UserContext";
import { uploadVerificationDocument } from "@/services/api";
import { API_BASE_URL } from "@/config/api";
import { getUserFriendlyErrorMessage } from "@/utils/errorHandler";
import { navigateToNextStep } from "@/utils/payoutNavigation";

interface ImageAsset {
  uri: string;
  width?: number;
  height?: number;
}

export default function DocumentUploadScreen(): React.JSX.Element {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'uploading' | 'processing' | 'complete' | 'error'>('uploading');
  const [frontImage, setFrontImage] = useState<ImageAsset | null>(null);
  const [backImage, setBackImage] = useState<ImageAsset | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Verify ImagePicker is available
    if (!ImagePicker) {
      setErrorMessage("Image picker is not available. Please restart the app.");
    }
  }, []);

  /**
   * Check and request media library permission
   */
  const ensureMediaLibraryPermission = async (): Promise<boolean> => {
    try {
      const { status: existingStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
      
      if (existingStatus === "granted") {
        return true;
      }

      if (existingStatus === "undetermined") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        return status === "granted";
      }

      // Permission was denied
      Alert.alert(
        "Permission Required",
        "Photo library access is required to upload your ID. Please enable it in your device settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => {
            // On iOS, this will open Settings app
            if (Platform.OS === "ios") {
              // Linking.openSettings() would be ideal but requires expo-linking
              Alert.alert("Settings", "Please go to Settings > Waypool Driver > Photos and enable access.");
            }
          }},
        ]
      );
      return false;
    } catch (error: any) {
      console.error("[DocumentUpload] Permission error:", error);
      setErrorMessage("Failed to check photo library permission. Please try again.");
      return false;
    }
  };

  /**
   * Check and request camera permission
   */
  const ensureCameraPermission = async (): Promise<boolean> => {
    try {
      const { status: existingStatus } = await ImagePicker.getCameraPermissionsAsync();
      
      if (existingStatus === "granted") {
        return true;
      }

      if (existingStatus === "undetermined") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        return status === "granted";
      }

      // Permission was denied
      Alert.alert(
        "Permission Required",
        "Camera access is required to take photos of your ID. Please enable it in your device settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => {
            if (Platform.OS === "ios") {
              Alert.alert("Settings", "Please go to Settings > Waypool Driver > Camera and enable access.");
            }
          }},
        ]
      );
      return false;
    } catch (error: any) {
      console.error("[DocumentUpload] Camera permission error:", error);
      setErrorMessage("Failed to check camera permission. Please try again.");
      return false;
    }
  };

  /**
   * Pick image from photo library
   */
  const pickImageFromLibrary = async (type: "front" | "back") => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const hasPermission = await ensureMediaLibraryPermission();
      if (!hasPermission) {
        setLoading(false);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Disable editing to prevent crashes
        quality: 1, // Get full quality first, we'll compress it
        base64: false,
        selectionLimit: 1,
        exif: false, // Remove EXIF data for privacy and smaller size
      });

      if (result.canceled) {
        setLoading(false);
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.uri) {
          try {
            // Compress the image before storing
            console.log("[DocumentUpload] Compressing camera image...");
            const compressed = await compressImage(asset.uri, CompressionPresets.document);
            console.log(
              `[DocumentUpload] Image compressed: ${compressed.originalSize} → ${compressed.compressedSize} bytes ` +
              `(${((1 - compressed.compressionRatio) * 100).toFixed(1)}% reduction)`
            );

            const imageAsset: ImageAsset = {
              uri: compressed.uri,
              width: compressed.width,
              height: compressed.height,
            };
            
            if (type === "front") {
              setFrontImage(imageAsset);
            } else {
              setBackImage(imageAsset);
            }
          } catch (compressionError: any) {
            console.error("[DocumentUpload] Compression error:", compressionError);
            
            // Show helpful message if native module isn't available
            if (compressionError?.message?.includes('native rebuild') || compressionError?.message?.includes('native module')) {
              Alert.alert(
                "Compression Unavailable",
                "Image compression requires a native rebuild. Using original image.\n\nTo enable compression, run:\nnpx expo prebuild && npx expo run:ios (or run:android)",
                [{ text: "OK" }]
              );
            }
            
            // Fallback to original image if compression fails
            const imageAsset: ImageAsset = {
              uri: asset.uri,
              width: asset.width || 0,
              height: asset.height || 0,
            };
            
            if (type === "front") {
              setFrontImage(imageAsset);
            } else {
              setBackImage(imageAsset);
            }
          }
        } else {
          setErrorMessage("Failed to load selected image. Please try again.");
        }
      }
    } catch (error: any) {
      console.error("[DocumentUpload] Library picker error:", error);
      const errorMsg = error?.message || "Failed to open photo library";
      setErrorMessage(errorMsg);
      Alert.alert("Error", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Take photo with camera
   */
  const takePhotoWithCamera = async (type: "front" | "back") => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const hasPermission = await ensureCameraPermission();
      if (!hasPermission) {
        setLoading(false);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Disable editing to prevent crashes
        quality: 1, // Get full quality first, we'll compress it
        base64: false,
        exif: false, // Remove EXIF data for privacy and smaller size
      });

      if (result.canceled) {
        setLoading(false);
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.uri) {
          try {
            // Compress the image before storing
            console.log("[DocumentUpload] Compressing camera image...");
            const compressed = await compressImage(asset.uri, CompressionPresets.document);
            console.log(
              `[DocumentUpload] Image compressed: ${compressed.originalSize} → ${compressed.compressedSize} bytes ` +
              `(${((1 - compressed.compressionRatio) * 100).toFixed(1)}% reduction)`
            );

            const imageAsset: ImageAsset = {
              uri: compressed.uri,
              width: compressed.width,
              height: compressed.height,
            };
            
            if (type === "front") {
              setFrontImage(imageAsset);
            } else {
              setBackImage(imageAsset);
            }
          } catch (compressionError: any) {
            console.error("[DocumentUpload] Compression error:", compressionError);
            
            // Show helpful message if native module isn't available
            if (compressionError?.message?.includes('native rebuild') || compressionError?.message?.includes('native module')) {
              Alert.alert(
                "Compression Unavailable",
                "Image compression requires a native rebuild. Using original image.\n\nTo enable compression, run:\nnpx expo prebuild && npx expo run:ios (or run:android)",
                [{ text: "OK" }]
              );
            }
            
            // Fallback to original image if compression fails
            const imageAsset: ImageAsset = {
              uri: asset.uri,
              width: asset.width || 0,
              height: asset.height || 0,
            };
            
            if (type === "front") {
              setFrontImage(imageAsset);
            } else {
              setBackImage(imageAsset);
            }
          }
        } else {
          setErrorMessage("Failed to load captured image. Please try again.");
        }
      }
    } catch (error: any) {
      console.error("[DocumentUpload] Camera error:", error);
      const errorMsg = error?.message || "Failed to open camera";
      setErrorMessage(errorMsg);
      Alert.alert("Error", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Show image picker options
   */
  const showImagePickerOptions = (type: "front" | "back") => {
    Alert.alert(
      "Select Image",
      "Choose an option",
      [
        {
          text: "Photo Library",
          onPress: () => pickImageFromLibrary(type),
        },
        {
          text: "Take Photo",
          onPress: () => takePhotoWithCamera(type),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ],
      { cancelable: true }
    );
  };

  /**
   * Handle upload
   */
  const handleUpload = async () => {
    console.log("[DocumentUpload] handleUpload called");
    
    if (!user?.id) {
      console.error("[DocumentUpload] User not found");
      Alert.alert("Error", "User not found");
      return;
    }

    if (!frontImage?.uri) {
      console.error("[DocumentUpload] Front image missing");
      Alert.alert("Validation Error", "Please upload the front of your ID document");
      return;
    }

    // Validate URI format
    if (
      !frontImage.uri.startsWith("file://") &&
      !frontImage.uri.startsWith("content://") &&
      !frontImage.uri.startsWith("ph://")
    ) {
      console.error("[DocumentUpload] Invalid URI format:", frontImage.uri);
      Alert.alert("Error", "Invalid image file. Please select the image again.");
      return;
    }

    try {
      console.log("[DocumentUpload] ===== STARTING UPLOAD PROCESS ===== ");
      console.log("[DocumentUpload] Starting upload process");
      setUploading(true);
      setUploadProgress(0);
      setUploadStatus('uploading');
      setErrorMessage(null);
      HapticFeedback.action();

      console.log("[DocumentUpload] Calling uploadVerificationDocument");
      console.log("[DocumentUpload] Driver ID:", user.id);
      console.log("[DocumentUpload] Front URI:", frontImage.uri.substring(0, 50) + "...");
      if (backImage?.uri) {
        console.log("[DocumentUpload] Back URI:", backImage.uri.substring(0, 50) + "...");
      } else {
        console.log("[DocumentUpload] No back image provided");
      }

      console.log("[DocumentUpload] About to call uploadVerificationDocument API...");
      console.log("[DocumentUpload] API_BASE_URL:", API_BASE_URL);
      console.log("[DocumentUpload] Full endpoint will be:", `${API_BASE_URL}/api/driver/connect/custom/upload-document`);
      const uploadStartTime = Date.now();
      
      // Progress tracking callback
      const handleProgress = (progress: number) => {
        setUploadProgress(progress);
        if (progress < 0.9) {
          setUploadStatus('uploading');
        } else {
          setUploadStatus('processing');
        }
      };
      
      const result = await uploadVerificationDocument(
        user.id,
        frontImage.uri,
        backImage?.uri,
        handleProgress
      );
      
      const uploadTime = Date.now() - uploadStartTime;
      console.log("[DocumentUpload] ===== UPLOAD API CALL COMPLETED ===== ");
      console.log("[DocumentUpload] Upload API call took:", uploadTime, "ms");

      console.log("[DocumentUpload] Upload successful, result:", result);
      setUploadStatus('complete');
      setUploadProgress(1);
      HapticFeedback.success();

      // Navigate to next step
      await navigateToNextStep(user.id);
      console.log("[DocumentUpload] Navigation complete");
    } catch (error: any) {
      console.error("[DocumentUpload] Upload error:", error);
      console.error("[DocumentUpload] Error type:", typeof error);
      console.error("[DocumentUpload] Error message:", error?.message);
      console.error("[DocumentUpload] Error stack:", error?.stack);
      
      const errorMsg = getUserFriendlyErrorMessage(error);
      console.error("[DocumentUpload] User-friendly error message:", errorMsg);
      
      setUploadStatus('error');
      setErrorMessage(errorMsg);
      HapticFeedback.error();
      Alert.alert("Upload Failed", errorMsg);
    } finally {
      console.log("[DocumentUpload] Upload process finished, setting uploading to false");
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <IconSymbol name="chevron.left" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Identity Document</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        <Text style={styles.subtitle}>
          Upload a photo of your government-issued ID for verification. This helps us verify your identity securely.
        </Text>

        <View style={styles.infoBox}>
          <IconSymbol name="lock.shield.fill" size={24} color="#4285F4" />
          <Text style={styles.infoText}>
            Your documents are encrypted and securely stored. We use this only for identity verification.
          </Text>
        </View>

        {errorMessage && (
          <View style={styles.errorBox}>
            <IconSymbol name="exclamationmark.triangle.fill" size={20} color="#FF3B30" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        <View style={styles.form}>
          {/* Front of ID */}
          <View style={styles.uploadSection}>
            <Text style={styles.sectionTitle}>Front of ID *</Text>
            <Text style={styles.sectionSubtitle}>
              Driver's license, passport, or state ID
            </Text>
            
            {frontImage ? (
              <View style={styles.imageContainer}>
                <Image source={{ uri: frontImage.uri }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => setFrontImage(null)}
                  disabled={loading || uploading}
                >
                  <IconSymbol name="xmark.circle.fill" size={24} color="#FF3B30" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.changeButton}
                  onPress={() => showImagePickerOptions("front")}
                  disabled={loading || uploading}
                >
                  <Text style={styles.changeButtonText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.uploadButton, (loading || uploading) && styles.uploadButtonDisabled]}
                onPress={() => showImagePickerOptions("front")}
                disabled={loading || uploading}
              >
                {loading ? (
                  <ActivityIndicator color="#4285F4" />
                ) : (
                  <>
                    <IconSymbol name="photo.fill" size={32} color="#4285F4" />
                    <Text style={styles.uploadButtonText}>Select Front of ID</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Back of ID (Optional) */}
          <View style={styles.uploadSection}>
            <Text style={styles.sectionTitle}>Back of ID (Optional)</Text>
            <Text style={styles.sectionSubtitle}>
              Only required if your ID has information on both sides
            </Text>
            
            {backImage ? (
              <View style={styles.imageContainer}>
                <Image source={{ uri: backImage.uri }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => setBackImage(null)}
                  disabled={loading || uploading}
                >
                  <IconSymbol name="xmark.circle.fill" size={24} color="#FF3B30" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.changeButton}
                  onPress={() => showImagePickerOptions("back")}
                  disabled={loading || uploading}
                >
                  <Text style={styles.changeButtonText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.uploadButton, (loading || uploading) && styles.uploadButtonDisabled]}
                onPress={() => showImagePickerOptions("back")}
                disabled={loading || uploading}
              >
                {loading ? (
                  <ActivityIndicator color="#4285F4" />
                ) : (
                  <>
                    <IconSymbol name="photo.fill" size={32} color="#4285F4" />
                    <Text style={styles.uploadButtonText}>Select Back of ID</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.noteBox}>
            <IconSymbol name="info.circle.fill" size={20} color="#FF9500" />
            <Text style={styles.noteText}>
              Make sure your ID is clearly visible, well-lit, and all text is readable. Avoid glare and shadows.
            </Text>
          </View>
        </View>

        {/* Upload Progress Indicator */}
        {uploading && (
          <View style={styles.progressContainer}>
            <UploadProgress
              progress={uploadProgress}
              status={uploadStatus}
              fileName="ID Document"
              errorMessage={errorMessage || undefined}
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, (uploading || !frontImage) && styles.submitButtonDisabled]}
          onPress={handleUpload}
          disabled={uploading || !frontImage}
        >
          {uploading ? (
            <>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.submitButtonText}>Uploading...</Text>
            </>
          ) : (
            <>
              <Text style={styles.submitButtonText}>Upload Documents</Text>
              <IconSymbol name="arrow.right" size={20} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    padding: 24,
    paddingTop: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  subtitle: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 24,
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#E8F0FE",
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: "#4285F4",
    lineHeight: 20,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFEBEE",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#FF3B30",
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: "#FF3B30",
    lineHeight: 20,
  },
  form: {
    gap: 24,
    marginBottom: 24,
  },
  uploadSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#666666",
  },
  uploadButton: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#E0E0E0",
    borderStyle: "dashed",
    gap: 12,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonText: {
    fontSize: 14,
    color: "#4285F4",
    fontWeight: "500",
  },
  imageContainer: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F5F5F5",
  },
  imagePreview: {
    width: "100%",
    height: 200,
    resizeMode: "cover",
  },
  removeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 20,
    padding: 4,
  },
  changeButton: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "#4285F4",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changeButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF4E6",
    borderRadius: 8,
    padding: 12,
    gap: 12,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: "#FF9500",
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: "#4285F4",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
