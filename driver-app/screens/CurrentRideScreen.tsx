import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';

// Conditionally import Location only on native platforms
let Location: any = null;
if (Platform.OS !== 'web') {
  try {
    Location = require('expo-location');
  } catch (e) {
    console.warn('expo-location not available:', e);
  }
}

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface CurrentRide {
  id: number;
  fromAddress: string;
  toAddress: string;
  fromLatitude: number;
  fromLongitude: number;
  toLatitude: number;
  toLongitude: number;
  passengerName?: string;
  estimatedDuration?: string;
  distance?: number;
}

export default function CurrentRideScreen(): React.JSX.Element {
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const mapRef = React.useRef<MapView>(null);

  // Mock current ride data
  const [currentRide] = useState<CurrentRide>({
    id: 1,
    fromAddress: '123 Main Street, San Francisco, CA',
    toAddress: '456 Market Street, San Francisco, CA',
    fromLatitude: 37.7749,
    fromLongitude: -122.4194,
    toLatitude: 37.7896,
    toLongitude: -122.4019,
    passengerName: 'John Doe',
    estimatedDuration: '15 min',
    distance: 2.5,
  });

  // Get current location
  useEffect(() => {
    (async () => {
      if (Location && Platform.OS !== 'web') {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            setLocationError('Location permission denied');
            return;
          }

          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          setLocation({
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          });

          // Watch position for real-time updates
          Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 5000,
              distanceInterval: 10,
            },
            (newLocation: any) => {
              setLocation({
                latitude: newLocation.coords.latitude,
                longitude: newLocation.coords.longitude,
              });
            }
          );
        } catch (error) {
          console.error('Error getting location:', error);
          setLocationError('Failed to get location');
        }
      }
    })();
  }, []);

  // Fit map to show route when ready
  useEffect(() => {
    if (mapRef.current && currentRide) {
      const coordinates = [
        { latitude: currentRide.fromLatitude, longitude: currentRide.fromLongitude },
        { latitude: currentRide.toLatitude, longitude: currentRide.toLongitude },
      ];
      
      if (location) {
        coordinates.push(location);
      }

      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
          animated: true,
        });
      }, 500);
    }
  }, [currentRide, location]);

  const mapRegion: Region = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : {
        latitude: currentRide.fromLatitude,
        longitude: currentRide.fromLongitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  // Create route polyline coordinates
  const routeCoordinates = [
    { latitude: currentRide.fromLatitude, longitude: currentRide.fromLongitude },
    { latitude: currentRide.toLatitude, longitude: currentRide.toLongitude },
  ];

  const formatDistance = (km: number): string => {
    if (km < 1) return `${Math.round(km * 1000)}m`;
    return `${km.toFixed(1)}km`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      
      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          style={styles.map}
          initialRegion={mapRegion}
          showsUserLocation={true}
          showsMyLocationButton={true}
          followsUserLocation={true}
          loadingEnabled={true}>
          
          {/* Route line */}
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#4285F4"
            strokeWidth={4}
          />

          {/* Pickup marker */}
          <Marker
            coordinate={{
              latitude: currentRide.fromLatitude,
              longitude: currentRide.fromLongitude,
            }}
            title="Pickup"
            description={currentRide.fromAddress}
            pinColor="#4285F4"
          />

          {/* Destination marker */}
          <Marker
            coordinate={{
              latitude: currentRide.toLatitude,
              longitude: currentRide.toLongitude,
            }}
            title="Destination"
            description={currentRide.toAddress}
            pinColor="#FF3B30"
          />
        </MapView>

        {/* Header overlay */}
        <View style={styles.headerOverlay}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}>
            <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Current Ride</Text>
          <View style={styles.backButton} />
        </View>

        {/* Bottom ride info card */}
        <View style={styles.rideInfoCard}>
          <View style={styles.rideInfoHeader}>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>In Progress</Text>
            </View>
            {currentRide.estimatedDuration && (
              <Text style={styles.etaText}>ETA: {currentRide.estimatedDuration}</Text>
            )}
          </View>

          {/* Route Info */}
          <View style={styles.routeInfo}>
            <View style={styles.routePoint}>
              <View style={styles.routeMarker} />
              <View style={styles.routeContent}>
                <Text style={styles.routeLabel}>PICKUP</Text>
                <Text style={styles.routeAddress}>{currentRide.fromAddress}</Text>
              </View>
            </View>

            <View style={styles.routeLine} />

            <View style={styles.routePoint}>
              <View style={[styles.routeMarker, styles.routeMarkerDest]} />
              <View style={styles.routeContent}>
                <Text style={styles.routeLabel}>DESTINATION</Text>
                <Text style={styles.routeAddress}>{currentRide.toAddress}</Text>
              </View>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            {currentRide.distance && (
              <View style={styles.statItem}>
                <IconSymbol size={18} name="mappin" color="#4285F4" />
                <Text style={styles.statValue}>{formatDistance(currentRide.distance)}</Text>
              </View>
            )}
            {currentRide.passengerName && (
              <View style={styles.statItem}>
                <IconSymbol size={18} name="house" color="#4285F4" />
                <Text style={styles.statValue}>{currentRide.passengerName}</Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
              <IconSymbol size={20} name="paperplane.fill" color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Contact</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.actionButtonPrimary]} 
              activeOpacity={0.7}>
              <Text style={styles.actionButtonTextPrimary}>Complete Ride</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  rideInfoCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  rideInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4285F4',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  etaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4285F4',
  },
  routeInfo: {
    marginBottom: 16,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeMarker: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4285F4',
    marginTop: 6,
    marginRight: 12,
  },
  routeMarkerDest: {
    backgroundColor: '#FF3B30',
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: '#2A2A2A',
    marginLeft: 4,
    marginVertical: 4,
  },
  routeContent: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    opacity: 0.5,
    marginBottom: 4,
    letterSpacing: 1,
  },
  routeAddress: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1A1A1A',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButtonPrimary: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  actionButtonTextPrimary: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.5,
  },
});

