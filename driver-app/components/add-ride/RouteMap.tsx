import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
} from 'react-native-maps';

interface RouteMapProps {
  mapRef: React.RefObject<MapView>;
  fromCoords: { latitude: number; longitude: number } | null;
  toCoords: { latitude: number; longitude: number } | null;
  routeCoordinates: { latitude: number; longitude: number }[];
  fromAddress: string;
  toAddress: string;
}

export const RouteMap: React.FC<RouteMapProps> = ({
  mapRef,
  fromCoords,
  toCoords,
  routeCoordinates,
  fromAddress,
  toAddress,
}) => {
  // Calculate region to show both markers
  const getInitialRegion = () => {
    if (fromCoords && toCoords) {
      const minLat = Math.min(fromCoords.latitude, toCoords.latitude);
      const maxLat = Math.max(fromCoords.latitude, toCoords.latitude);
      const minLng = Math.min(fromCoords.longitude, toCoords.longitude);
      const maxLng = Math.max(fromCoords.longitude, toCoords.longitude);

      const midLat = (minLat + maxLat) / 2;
      const midLng = (minLng + maxLng) / 2;
      const latDelta = (maxLat - minLat) * 1.5; // Add 50% padding
      const lngDelta = (maxLng - minLng) * 1.5;

      return {
        latitude: midLat,
        longitude: midLng,
        latitudeDelta: Math.max(latDelta, 0.05),
        longitudeDelta: Math.max(lngDelta, 0.05),
      };
    } else if (fromCoords) {
      return {
        latitude: fromCoords.latitude,
        longitude: fromCoords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    return {
      latitude: 37.78825,
      longitude: -122.4324,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
  };

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      initialRegion={getInitialRegion()}
      showsUserLocation={false}
      showsMyLocationButton={false}
    >
      {fromCoords && (
        <Marker
          coordinate={fromCoords}
          title="Pickup"
          description={fromAddress}
          pinColor="#34C759"
        />
      )}

      {toCoords && (
        <Marker
          coordinate={toCoords}
          title="Destination"
          description={toAddress}
          pinColor="#FF3B30"
        />
      )}

      {routeCoordinates.length > 0 && (
        <Polyline
          coordinates={routeCoordinates}
          strokeColor="#4285F4"
          strokeWidth={5}
          lineCap="round"
          lineJoin="round"
          geodesic={true}
        />
      )}
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: 250,
    borderRadius: 12,
  },
});

