import React from 'react';
import { Platform } from 'react-native';

// Platform-specific map component wrapper

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
// Using .native and .web extensions allows React Native to automatically resolve the correct file
const MapComponentImpl = Platform.OS === 'web'
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ? require('./MapComponent.web').default
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  : require('./MapComponent.native').default;

export default MapComponentImpl;



