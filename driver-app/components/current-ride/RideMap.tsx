import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
  Region,
} from 'react-native-maps';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface Passenger {
  id: number;
  riderName: string | null;
  pickupLatitude: number | null;
  pickupLongitude: number | null;
  pickupStatus: string;
}

interface RideMapProps {
  mapRef: React.RefObject<MapView>;
  region: Region | null;
  driverLocation: LocationCoords | null;
  routeCoordinates: { latitude: number; longitude: number }[];
  pickupMarkers: Passenger[];
  originLocation: LocationCoords | null;
  originLabel: string;
  destinationLocation: LocationCoords | null;
  destinationLabel: string;
  onRegionChangeComplete?: (region: Region) => void;
}

export const RideMap: React.FC<RideMapProps> = ({
  mapRef,
  region,
  driverLocation,
  routeCoordinates,
  pickupMarkers,
  originLocation,
  originLabel,
  destinationLocation,
  destinationLabel,
  onRegionChangeComplete,
}) => {
  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      initialRegion={region || undefined}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsCompass={true}
      zoomEnabled={true}
      scrollEnabled={true}
      rotateEnabled={true}
      pitchEnabled={false}
      onRegionChangeComplete={onRegionChangeComplete}
      mapType="standard"
    >
      {/* Route Polyline */}
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

      {/* Starting Point Marker */}
      {originLocation && (
        <Marker
          coordinate={originLocation}
          title="Starting Point"
          description={originLabel}
          pinColor="#34C759"
        />
      )}

      {/* Pickup Location Markers */}
      {pickupMarkers.map((passenger) => {
        if (!passenger.pickupLatitude || !passenger.pickupLongitude) return null;

        const isPickedUp = passenger.pickupStatus === 'picked_up';

        return (
          <Marker
            key={`pickup-${passenger.id}`}
            coordinate={{
              latitude: passenger.pickupLatitude,
              longitude: passenger.pickupLongitude,
            }}
            title={passenger.riderName || 'Passenger'}
            description={isPickedUp ? 'Picked up' : 'Waiting for pickup'}
            pinColor={isPickedUp ? '#34C759' : '#FF9500'}
            opacity={isPickedUp ? 0.6 : 1.0}
          />
        );
      })}

      {/* Destination Marker */}
      {destinationLocation && (
        <Marker
          coordinate={destinationLocation}
          title="Destination"
          description={destinationLabel}
          pinColor="#FF3B30"
        />
      )}
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});

