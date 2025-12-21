import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Google Maps API key from environment variables
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

export interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export interface AddressDetails {
  fullAddress: string;
  placeId: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectAddress: (addressDetails: AddressDetails) => void;
  placeholder: string;
  error?: string;
  showPredictionsInline?: boolean;
  onPredictionsChange?: (predictions: PlacePrediction[]) => void;
  onFocusChange?: (focused: boolean) => void;
  onSelectionHandler?: (handler: (prediction: PlacePrediction) => void) => void;
  disabled?: boolean;
  currentLocation?: { latitude: number; longitude: number } | null;
}

export default function AddressAutocomplete({
  value,
  onChangeText,
  onSelectAddress,
  placeholder,
  error,
  showPredictionsInline = true,
  onPredictionsChange,
  onFocusChange,
  onSelectionHandler,
  disabled = false,
  currentLocation = null,
}: AddressAutocompleteProps): React.JSX.Element {
  // Debug: Log when currentLocation changes
  useEffect(() => {
    if (currentLocation) {
      console.log('📍 [AddressAutocomplete] Received currentLocation:', currentLocation);
    } else {
      console.log('📍 [AddressAutocomplete] No currentLocation provided');
    }
  }, [currentLocation]);

  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  // Initialize hasSelectedAddress based on whether value is already set (user came back from step 2)
  const [hasSelectedAddress, setHasSelectedAddress] = useState(() => {
    // If value is already set when component mounts, treat it as a selected address
    return !!value && value.trim().length > 0;
  });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSelectingRef = useRef(false);
  const isTouchingPredictionRef = useRef(false);
  const inputRef = useRef<any>(null);
  
  // Force update TextInput when value changes
  useEffect(() => {
    if (inputRef.current && value !== inputRef.current.value) {
      inputRef.current.setNativeProps({ text: value });
    }
  }, [value]);
  
  // Reset hasSelectedAddress when value is cleared
  useEffect(() => {
    if (!value || value.trim().length === 0) {
      setHasSelectedAddress(false);
    } else if (value && value.trim().length > 0 && !isFocused) {
      // If value exists but input is not focused, treat as selected address
      // This prevents suggestions from showing when coming back from step 2
      setHasSelectedAddress(true);
      setShowPredictions(false);
      setPredictions([]);
      if (onPredictionsChange) {
        onPredictionsChange([]);
      }
    }
  }, [value, isFocused, onPredictionsChange]);

  // Calculate distance between two coordinates using Haversine formula (in miles)
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 3959; // Radius of the Earth in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Fetch place details to get coordinates for distance calculation
  const fetchPlaceDetailsForSorting = async (
    placeId: string
  ): Promise<{ latitude: number; longitude: number } | null> => {
    if (!GOOGLE_PLACES_API_KEY) return null;

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${GOOGLE_PLACES_API_KEY}`
      );
      const data = await response.json();

      if (data.status === 'OK' && data.result?.geometry?.location) {
        return {
          latitude: data.result.geometry.location.lat,
          longitude: data.result.geometry.location.lng,
        };
      }
    } catch (error) {
    }
    return null;
  };


  // Fetch predictions from Google Places API
  const fetchPredictions = useCallback(async (input: string) => {
    if (!input || input.length < 3) {
      setPredictions([]);
      return;
    }

    if (!GOOGLE_PLACES_API_KEY) {
      const errorMsg = 'Google Places API key is not configured. Please set EXPO_PUBLIC_GOOGLE_PLACES_API_KEY in your .env file.';
      setApiKeyError(errorMsg);
      setPredictions([]);
      setIsLoading(false);
      return;
    } else {
      // Clear any previous API key errors
      setApiKeyError(null);
    }

    setIsLoading(true);
    try {
      // Build API URL with location bias if available
      let apiUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        input
      )}&key=${GOOGLE_PLACES_API_KEY}&components=country:us`;
      
      // Add location bias to prioritize nearby results
      if (currentLocation && currentLocation.latitude && currentLocation.longitude) {
        console.log('📍 [AddressAutocomplete] Using location bias:', currentLocation);
        // Use location and radius for better local suggestions (5km radius = 5000 meters)
        // Smaller radius gives more localized results
        apiUrl += `&location=${currentLocation.latitude},${currentLocation.longitude}&radius=5000`;
      } else {
        console.log('📍 [AddressAutocomplete] No current location available for bias');
      }
      
      console.log('📍 [AddressAutocomplete] Fetching predictions with URL:', apiUrl.replace(GOOGLE_PLACES_API_KEY, 'API_KEY_HIDDEN'));
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      console.log('📍 [AddressAutocomplete] API response status:', data.status);
      console.log('📍 [AddressAutocomplete] Number of predictions:', data.predictions?.length || 0);
      
      // Log error details if present
      if (data.error_message) {
        console.error('📍 [AddressAutocomplete] API error message:', data.error_message);
      }

      if (data.status === 'OK' && data.predictions) {
        let sortedPredictions = data.predictions;
        
        console.log('📍 [AddressAutocomplete] First 3 predictions:', 
          sortedPredictions.slice(0, 3).map(p => p.description)
        );

        // Sort by distance if current location is available
        if (currentLocation && data.predictions.length > 0) {
          // For now, use predictions as-is without sorting by distance
          // (fetchPlaceDetailsForSorting would require additional API calls)
          // In a production app, you might want to implement this optimization
        }

        setPredictions(sortedPredictions);
        setShowPredictions(true);
        if (onPredictionsChange) {
          onPredictionsChange(sortedPredictions);
        }
      } else if (data.status === 'REQUEST_DENIED') {
        const errorMsg = data.error_message || 'API request denied';
        console.error('📍 [AddressAutocomplete] Google Places API REQUEST_DENIED');
        console.error('📍 [AddressAutocomplete] Error message:', errorMsg);
        console.error('📍 [AddressAutocomplete] Possible causes:');
        console.error('   1. API key is invalid or missing');
        console.error('   2. Places API is not enabled in Google Cloud Console');
        console.error('   3. API key has restrictions (IP/HTTP referrer) blocking the request');
        console.error('   4. Billing is not enabled on the Google Cloud project');
        setApiKeyError(`API access denied: ${errorMsg}. Check API key configuration in Google Cloud Console.`);
        setPredictions([]);
        setShowPredictions(false);
        if (onPredictionsChange) {
          onPredictionsChange([]);
        }
      } else if (data.status === 'ZERO_RESULTS') {
        console.log('📍 [AddressAutocomplete] No results found for:', input);
        setPredictions([]);
        setShowPredictions(false);
        if (onPredictionsChange) {
          onPredictionsChange([]);
        }
      } else {
        const errorMsg = data.error_message || 'Unknown error';
        console.warn('📍 [AddressAutocomplete] API returned status:', data.status);
        console.warn('📍 [AddressAutocomplete] Error message:', errorMsg);
        setPredictions([]);
        setShowPredictions(false);
        if (onPredictionsChange) {
          onPredictionsChange([]);
        }
      }
    } catch (error) {
      console.error('📍 [AddressAutocomplete] Error fetching predictions:', error);
      setPredictions([]);
      setShowPredictions(false);
      if (onPredictionsChange) {
        onPredictionsChange([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentLocation, onPredictionsChange]);

  // Debounce address input
  useEffect(() => {
    // If parent is handling predictions (showPredictionsInline=false), don't do anything
    if (!showPredictionsInline) {
      return;
    }
    
    // Don't fetch predictions if disabled, just selected an address, address already selected, or input is not focused
    if (disabled || isSelectingRef.current || hasSelectedAddress || !isFocused) {
      if (isSelectingRef.current) {
        isSelectingRef.current = false;
      }
      // Clear predictions if input is not focused
      if (!isFocused) {
        setPredictions([]);
        setShowPredictions(false);
        setIsLoading(false);
        if (onPredictionsChange) {
          onPredictionsChange([]);
        }
      }
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (value && value.length >= 3) {
      // Show loading immediately
      setIsLoading(true);
      
      timeoutRef.current = setTimeout(() => {
        fetchPredictions(value);
      }, 200) as any;
    } else {
      setPredictions([]);
      setShowPredictions(false);
      setIsLoading(false);
      if (onPredictionsChange) {
        onPredictionsChange([]);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, disabled, showPredictionsInline, hasSelectedAddress, isFocused, fetchPredictions, onPredictionsChange]);

  // Parse address from description string (declare before fetchPlaceDetails)
  const parseAddressFromDescription = useCallback((fullAddress: string, displayAddress: string, placeId: string) => {
    const parts = fullAddress.split(', ');
    let city = '';
    let state = '';
    let zipCode = '';

    if (parts.length >= 3) {
      // Format: "Street, City, State ZIP, Country"
      // or "Street, Borough, City, State ZIP, Country" (for NYC)
      const stateZipIndex = parts.length - 2;
      const cityIndex = parts.length - 3;

      city = parts[cityIndex] || '';
      const stateZip = parts[stateZipIndex] || '';
      const stateZipParts = stateZip.trim().split(' ');
      state = stateZipParts[0] || '';
      zipCode = stateZipParts[1] || '';

      // For Brooklyn/Queens/Bronx (NYC boroughs), use the borough as city
      if (!city && parts.length >= 4) {
        city = parts[parts.length - 4] || '';
      }
    }

    const addressDetails: AddressDetails = {
      fullAddress: displayAddress,
      placeId,
      city,
      state,
      zipCode,
    };
    
    onSelectAddress(addressDetails);
  }, [onSelectAddress]);

  // Fetch detailed place information (declare before handleSelectPrediction)
  const fetchPlaceDetails = useCallback(async (placeId: string, fullAddress: string, displayAddress: string) => {
    if (!GOOGLE_PLACES_API_KEY) {
      return;
    }

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=address_components,geometry&key=${GOOGLE_PLACES_API_KEY}`
      );

      const data = await response.json();

      if (data.status === 'OK' && data.result) {
        const components = data.result.address_components;
        let city = '';
        let state = '';
        let zipCode = '';

        // Extract address components
        components.forEach((component: any) => {
          // Try multiple types for city (locality, sublocality, neighborhood)
          if (component.types.includes('locality') && !city) {
            city = component.long_name;
          }
          if (component.types.includes('sublocality_level_1') && !city) {
            city = component.long_name;
          }
          if (component.types.includes('sublocality') && !city) {
            city = component.long_name;
          }
          if (component.types.includes('neighborhood') && !city) {
            city = component.long_name;
          }
          if (component.types.includes('administrative_area_level_3') && !city) {
            city = component.long_name;
          }
          if (component.types.includes('administrative_area_level_1')) {
            state = component.long_name;
          }
          if (component.types.includes('postal_code')) {
            zipCode = component.long_name;
          }
        });

        // Use the full address that was displayed to the user
        const addressDetails: AddressDetails = {
          fullAddress: fullAddress,
          placeId,
          city,
          state,
          zipCode,
          latitude: data.result.geometry?.location?.lat,
          longitude: data.result.geometry?.location?.lng,
        };
        
        onSelectAddress(addressDetails);
      } else {
        // Fallback if API fails - parse from description
        parseAddressFromDescription(fullAddress, displayAddress, placeId);
      }
    } catch (error) {
      // Fallback - try to parse from description
      parseAddressFromDescription(fullAddress, displayAddress, placeId);
    }
  }, [onSelectAddress, parseAddressFromDescription]);

  // Handle prediction selection (declare after fetchPlaceDetails)
  const handleSelectPrediction = useCallback(async (prediction: PlacePrediction) => {
    // Use the full description for the input field
    const fullAddress = prediction.description;
    
    // Cancel any pending timeouts
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Mark that an address has been selected
    setHasSelectedAddress(true);
    
    // Then hide suggestions immediately
    setShowPredictions(false);
    setPredictions([]);
    setIsFocused(false);
    setIsLoading(false);
    
    // Notify parent that predictions are cleared
    if (onPredictionsChange) {
      onPredictionsChange([]);
    }
    
    // Set flag to prevent useEffect from re-fetching predictions
    isSelectingRef.current = true;
    
    // Immediately update the text input with full address so user sees it right away
    onChangeText(fullAddress);
    
    // Fetch place details to get city, state, zip, and coordinates
    // This will call onSelectAddress with the complete details
    fetchPlaceDetails(prediction.place_id, fullAddress, fullAddress);
  }, [onChangeText, onPredictionsChange, fetchPlaceDetails]);

  // Expose selection handler to parent
  useEffect(() => {
    if (onSelectionHandler) {
      onSelectionHandler(handleSelectPrediction);
    }
  }, [onSelectionHandler, handleSelectPrediction]);


  const handleChangeText = (text: string) => {
    // If user is typing, they're changing the address - reset selection state
    if (hasSelectedAddress) {
      setHasSelectedAddress(false);
      // Clear any existing predictions when user starts editing
      setShowPredictions(false);
      setPredictions([]);
      if (onPredictionsChange) {
        onPredictionsChange([]);
      }
    }
    
    onChangeText(text);
    if (!text) {
      setShowPredictions(false);
      setPredictions([]);
      setIsLoading(false);
      if (onPredictionsChange) {
        onPredictionsChange([]);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            isFocused && styles.inputFocused,
            error && styles.inputError,
          ]}
          placeholder={placeholder}
          placeholderTextColor="#666666"
          value={value}
          onChangeText={handleChangeText}
          autoCapitalize="words"
          onFocus={() => {
            setIsFocused(true);
            if (onFocusChange) {
              onFocusChange(true);
            }
            // Cancel any pending blur
            if (blurTimeoutRef.current) {
              clearTimeout(blurTimeoutRef.current);
            }
            // Only show predictions if no address has been selected yet and user is actively typing
            // Don't auto-show predictions if address was already selected (value exists on mount)
            if (predictions.length > 0 && !hasSelectedAddress) {
              setShowPredictions(true);
            }
            // If address was already selected, don't fetch new predictions on focus
            if (hasSelectedAddress && value && value.trim().length > 0) {
              setShowPredictions(false);
              setPredictions([]);
              if (onPredictionsChange) {
                onPredictionsChange([]);
              }
            }
          }}
          onBlur={() => {
            // Delay blur to allow selection to complete
            blurTimeoutRef.current = setTimeout(() => {
              // Double check - if a selection is in progress or user is touching a prediction, don't blur
              if (isSelectingRef.current) {
                return;
              }
              if (isTouchingPredictionRef.current) {
                return;
              }
              setIsFocused(false);
              setShowPredictions(false);
              setPredictions([]);
              if (onFocusChange) {
                onFocusChange(false);
              }
              if (onPredictionsChange) {
                onPredictionsChange([]);
              }
            }, 500) as any;
          }}
        />
        {isLoading && (
          <View style={styles.loadingIndicator}>
            <ActivityIndicator size="small" color="#4285F4" />
          </View>
        )}
      </View>

      {/* API Key Error Message */}
      {apiKeyError && isFocused && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            ⚠️ {apiKeyError}
          </Text>
        </View>
      )}

      {/* Error message from parent */}
      {error && !apiKeyError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Predictions Dropdown - Inline Below Input */}
      {showPredictionsInline && showPredictions && predictions.length > 0 && !hasSelectedAddress && (
        <View style={styles.predictionsContainer}>
          <ScrollView
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            style={styles.predictionsList}
            nestedScrollEnabled={true}
          >
            {predictions.map((item, index) => (
              <Pressable
                key={item.place_id}
                style={styles.predictionItem}
                onTouchStart={() => {
                  isTouchingPredictionRef.current = true;
                  // Cancel blur timeout immediately
                  if (blurTimeoutRef.current) {
                    clearTimeout(blurTimeoutRef.current);
                    blurTimeoutRef.current = null;
                  }
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  isTouchingPredictionRef.current = false;
                  
                  // Directly handle selection on touch end
                  handleSelectPrediction(item);
                }}>
                <View style={styles.predictionIcon}>
                  <IconSymbol size={18} name="location" color="#4285F4" />
                </View>
                <View style={styles.predictionText}>
                  <Text style={styles.predictionMain}>
                    {item.structured_formatting.main_text}
                  </Text>
                  <Text style={styles.predictionSecondary}>
                    {item.structured_formatting.secondary_text}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 8,
    paddingRight: 30,
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '400',
  },
  inputFocused: {
    backgroundColor: 'transparent',
  },
  inputError: {
    borderColor: '#FF3B30',
    borderWidth: 1,
  },
  loadingIndicator: {
    position: 'absolute',
    right: 0,
    top: '50%',
    marginTop: -10,
  },
  predictionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 250,
    overflow: 'visible',
    zIndex: 9999,
    elevation: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    borderWidth: 2,
    borderColor: '#4285F4',
  },
  predictionsList: {
    maxHeight: 250,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    gap: 14,
    backgroundColor: '#000000',
  },
  predictionItemPressed: {
    backgroundColor: '#1A1A1A',
  },
  predictionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  predictionText: {
    flex: 1,
    paddingTop: 2,
  },
  predictionMain: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 5,
    letterSpacing: -0.2,
  },
  predictionSecondary: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999999',
    lineHeight: 18,
  },
  errorContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#FF3B3015',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 13,
    color: '#FF3B30',
    lineHeight: 18,
  },
});

