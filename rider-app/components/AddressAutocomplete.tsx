import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
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
  currentLocation?: { latitude: number; longitude: number } | null;
}

export default function AddressAutocomplete({
  value,
  onChangeText,
  onSelectAddress,
  placeholder,
  error,
  currentLocation = null,
}: AddressAutocompleteProps): React.JSX.Element {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<any>(null);

  // Fetch predictions from Google Places API
  const fetchPredictions = async (input: string) => {
    if (!input || input.length < 3) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    if (!GOOGLE_PLACES_API_KEY) {
      console.error('Google Places API key is not configured.');
      setPredictions([]);
      return;
    }

    setIsLoading(true);
    try {
      let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${GOOGLE_PLACES_API_KEY}`;
      
      // Add location bias if current location is available
      if (currentLocation) {
        url += `&location=${currentLocation.latitude},${currentLocation.longitude}&radius=50000`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.predictions) {
        setPredictions(data.predictions);
        setShowPredictions(true);
      } else {
        setPredictions([]);
        setShowPredictions(false);
      }
    } catch (error) {
      console.error('Error fetching predictions:', error);
      setPredictions([]);
      setShowPredictions(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextChange = (text: string) => {
    onChangeText(text);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      fetchPredictions(text);
    }, 300);
  };

  const handleSelectPrediction = async (prediction: PlacePrediction) => {
    setShowPredictions(false);
    onChangeText(prediction.description);

    try {
      // Get place details
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=formatted_address,address_components,geometry&key=${GOOGLE_PLACES_API_KEY}`;
      const response = await fetch(detailsUrl);
      const data = await response.json();

      if (data.status === 'OK' && data.result) {
        const result = data.result;
        const addressComponents = result.address_components || [];
        
        let city = '';
        let state = '';
        let zipCode = '';

        addressComponents.forEach((component: any) => {
          if (component.types.includes('locality')) {
            city = component.long_name;
          } else if (component.types.includes('administrative_area_level_1')) {
            state = component.short_name;
          } else if (component.types.includes('postal_code')) {
            zipCode = component.long_name;
          }
        });

        const addressDetails: AddressDetails = {
          fullAddress: result.formatted_address || prediction.description,
          placeId: prediction.place_id,
          city,
          state,
          zipCode,
          latitude: result.geometry?.location?.lat,
          longitude: result.geometry?.location?.lng,
        };

        onSelectAddress(addressDetails);
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.inputContainer, error && styles.inputError]}>
        <IconSymbol name="mappin" size={20} color="#666666" style={styles.icon} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#666666"
          value={value}
          onChangeText={handleTextChange}
          onFocus={() => {
            if (predictions.length > 0) {
              setShowPredictions(true);
            }
          }}
        />
        {isLoading && (
          <ActivityIndicator size="small" color="#4285F4" style={styles.loader} />
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
      
      {showPredictions && predictions.length > 0 && (
        <View style={styles.predictionsContainer}>
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.place_id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.predictionItem}
                onPress={() => handleSelectPrediction(item)}
              >
                <IconSymbol name="mappin" size={16} color="#4285F4" style={styles.predictionIcon} />
                <View style={styles.predictionText}>
                  <Text style={styles.predictionMainText}>
                    {item.structured_formatting.main_text}
                  </Text>
                  <Text style={styles.predictionSecondaryText}>
                    {item.structured_formatting.secondary_text}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            style={styles.predictionsList}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2C',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    padding: 0,
  },
  loader: {
    marginLeft: 8,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  predictionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2C',
    marginTop: 8,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  predictionsList: {
    maxHeight: 200,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2C',
  },
  predictionIcon: {
    marginRight: 12,
  },
  predictionText: {
    flex: 1,
  },
  predictionMainText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  predictionSecondaryText: {
    fontSize: 13,
    color: '#999999',
  },
});

