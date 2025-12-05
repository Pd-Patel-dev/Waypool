import React from 'react';
import { Platform } from 'react-native';

interface Location {
  latitude: number;
  longitude: number;
}

interface MapComponentProps {
  location: Location | null;
  locationError: string | null;
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
}

// Conditionally load platform-specific implementation
let MapComponentImpl: React.ComponentType<MapComponentProps>;

if (Platform.OS === 'web') {
  // Web version - no native dependencies
  MapComponentImpl = require('./MapComponent.web').default;
} else {
  // Native version - uses react-native-maps
  MapComponentImpl = require('./MapComponent.native').default;
}

export default MapComponentImpl;



