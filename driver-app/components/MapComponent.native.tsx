import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, Text, ActivityIndicator } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { TIME } from '@/utils/constants';

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
  initialRegion,
}: MapComponentProps) {
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<MapView>(null);
  
  // Default region - always show map even without location
  const defaultRegion: Region = {
    latitude: 37.78825, // San Francisco default
    longitude: -122.4324,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const mapRegion: Region = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : initialRegion || defaultRegion;

  // Animate to user location when it becomes available
  useEffect(() => {
    if (location && mapReady && mapRef.current) {
      const region: Region = {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      mapRef.current.animateToRegion(region, 1000);
    }
  }, [location, mapReady]);

  return (
    <View style={styles.mapContainer}>
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        initialRegion={mapRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
        followsUserLocation={false}
        mapType="standard"
        loadingEnabled={true}
        loadingIndicatorColor="#FFFFFF"
        userLocationPriority="high"
        userLocationUpdateInterval={TIME.LOCATION_UPDATE_INTERVAL}
        onMapReady={() => setMapReady(true)}>
      </MapView>
      {!mapReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      )}
      {locationError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{locationError}</Text>
        </View>
      )}
      {!location && !locationError && mapReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadingText}>Getting location...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  errorOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 12,
    textAlign: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
});
