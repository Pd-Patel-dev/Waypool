import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
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
  }, [value, isFocused]);
  
  // Expose selection handler to parent
  useEffect(() => {
    if (onSelectionHandler) {
      onSelectionHandler(handleSelectPrediction);
    }
  }, [onSelectionHandler]);

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
      console.error('Error fetching place details:', error);
    }
    return null;
  };

  // Fetch predictions from Google Places API
  const fetchPredictions = async (input: string) => {
    if (!input || input.length < 3) {
      setPredictions([]);
      return;
    }

    if (!GOOGLE_PLACES_API_KEY) {
      const errorMsg = 'Google Places API key is not configured. Please set EXPO_PUBLIC_GOOGLE_PLACES_API_KEY in your .env file.';
      console.error(errorMsg);
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
      if (currentLocation) {
        apiUrl += `&location=${currentLocation.latitude},${currentLocation.longitude}&radius=50000`; // 50km radius
      }
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.status === 'OK' && data.predictions) {
        let sortedPredictions = data.predictions;

        // Sort by distance if current location is available
        if (currentLocation && data.predictions.length > 0) {
          // Limit to top 10 predictions for performance (fetch details for top results)
          const predictionsToSort = data.predictions.slice(0, 10);
          
          // Fetch coordinates for each prediction and sort by distance
          const predictionsWithDistance = await Promise.all(
            predictionsToSort.map(async (prediction: PlacePrediction) => {
              const coords = await fetchPlaceDetailsForSorting(prediction.place_id);
              let distance = Infinity; // Default to far away if coordinates not available
              
              if (coords) {
                distance = calculateDistance(
                  currentLocation.latitude,
                  currentLocation.longitude,
                  coords.latitude,
                  coords.longitude
                );
              }

              return {
                prediction,
                distance,
                coordinates: coords,
              };
            })
          );

          // Sort by distance (nearest first)
          predictionsWithDistance.sort((a, b) => a.distance - b.distance);
          
          // Combine sorted top results with remaining unsorted results
          const sortedTop = predictionsWithDistance.map((item) => item.prediction);
          const remaining = data.predictions.slice(10);
          sortedPredictions = [...sortedTop, ...remaining];
        }

        setPredictions(sortedPredictions);
        setShowPredictions(true);
        if (onPredictionsChange) {
          onPredictionsChange(sortedPredictions);
        }
      } else if (data.status === 'REQUEST_DENIED') {
        console.error('Google Places API error:', data.error_message);
        // Fallback: show mock suggestions for testing
        setMockPredictions(input);
      } else {
        setPredictions([]);
        if (onPredictionsChange) {
          onPredictionsChange([]);
        }
      }
    } catch (error) {
      console.error('Error fetching predictions:', error);
      // Fallback: show mock suggestions for testing
      setMockPredictions(input);
    } finally {
      setIsLoading(false);
    }
  };

  // Fallback mock predictions for testing when API fails
  const setMockPredictions = (input: string) => {
    const mockPredictions: PlacePrediction[] = [
      {
        place_id: 'mock-1',
        description: `${input} Street, San Francisco, CA 94102, USA`,
        structured_formatting: {
          main_text: `${input} Street`,
          secondary_text: 'San Francisco, CA 94102, USA',
        },
      },
      {
        place_id: 'mock-2',
        description: `${input} Avenue, Oakland, CA 94607, USA`,
        structured_formatting: {
          main_text: `${input} Avenue`,
          secondary_text: 'Oakland, CA 94607, USA',
        },
      },
      {
        place_id: 'mock-3',
        description: `${input} Road, San Jose, CA 95113, USA`,
        structured_formatting: {
          main_text: `${input} Road`,
          secondary_text: 'San Jose, CA 95113, USA',
        },
      },
    ];
    setPredictions(mockPredictions);
    setShowPredictions(true);
    if (onPredictionsChange) {
      onPredictionsChange(mockPredictions);
    }
  };

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
  }, [value, disabled, showPredictionsInline, hasSelectedAddress, isFocused]);

  const handleSelectPrediction = async (prediction: PlacePrediction) => {
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
  };

  // Fetch detailed place information
  const fetchPlaceDetails = async (placeId: string, fullAddress: string, displayAddress: string) => {
    if (!GOOGLE_PLACES_API_KEY) {
      console.error('Google Places API key is not configured. Please set EXPO_PUBLIC_GOOGLE_PLACES_API_KEY in your .env file.');
      return;
    }

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=address_components,geometry&key=${GOOGLE_PLACES_API_KEY}`
      );

      const data = await response.json();

      if (data.status === 'OK' && data.result) {
        const components = data.result.address_components;
        let streetNumber = '';
        let route = '';
        let city = '';
        let state = '';
        let zipCode = '';

        // Extract address components
        components.forEach((component: any) => {
          if (component.types.includes('street_number')) {
            streetNumber = component.long_name;
          }
          if (component.types.includes('route')) {
            route = component.long_name;
          }
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
      console.error('Error fetching place details:', error);
      // Fallback - try to parse from description
      parseAddressFromDescription(fullAddress, displayAddress, placeId);
    }
  };

  // Parse address from description string
  const parseAddressFromDescription = (fullAddress: string, displayAddress: string, placeId: string) => {
    const parts = fullAddress.split(', ');
    let city = '';
    let state = '';
    let zipCode = '';

    if (parts.length >= 3) {
      // Format: "Street, City, State ZIP, Country"
      // or "Street, Borough, City, State ZIP, Country" (for NYC)
      const countryIndex = parts.length - 1;
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
  };

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

