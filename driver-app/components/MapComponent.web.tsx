import React from 'react';
import { View, StyleSheet, Text } from 'react-native';

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

export default function MapComponent({
  location,
  locationError,
}: MapComponentProps) {
  return (
    <View style={styles.mapContainer}>
      <View style={styles.webMapPlaceholder}>
        <Text style={styles.webMapText}>📍</Text>
        <Text style={styles.webMapLabel}>Map View</Text>
        {location ? (
          <Text style={styles.webMapCoordinates}>
            {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          </Text>
        ) : (
          <Text style={styles.webMapMessage}>
            {locationError || 'Getting your location...'}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  webMapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    padding: 20,
  },
  webMapText: {
    fontSize: 48,
    marginBottom: 12,
  },
  webMapLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 8,
    opacity: 0.6,
  },
  webMapCoordinates: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 8,
    opacity: 0.4,
    fontWeight: '400',
  },
  webMapMessage: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.4,
    fontWeight: '400',
  },
});
