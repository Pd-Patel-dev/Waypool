import * as Location from "expo-location";
import { Platform } from "react-native";

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

export interface LocationInfo {
  coords: LocationCoords;
  city?: string;
  state?: string;
  error?: string;
}

export class LocationService {
  /**
   * Request location permissions
   */
  static async requestPermissions(): Promise<boolean> {
    if (Platform.OS === "web") return false;

    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === "granted";
  }

  /**
   * Get current location
   */
  static async getCurrentLocation(): Promise<LocationCoords> {
    if (Platform.OS === "web") {
      throw new Error("Location not available on web");
    }

    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
      throw new Error("Location permission not granted");
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  }

  /**
   * Reverse geocode coordinates to get city and state
   * Uses Expo Location first (no API key needed), falls back to Google Geocoding API
   */
  static async reverseGeocode(
    lat: number,
    lng: number
  ): Promise<{ city: string; state: string } | null> {
    // Try Expo Location reverse geocoding first (no API key needed, more reliable)
    if (Platform.OS !== "web") {
      try {
        console.log("📍 [LocationService] Using Expo reverse geocoding for:", lat, lng);
        const addresses = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });

        console.log("📍 [LocationService] Expo reverse geocode addresses:", JSON.stringify(addresses, null, 2));

        if (addresses && addresses.length > 0) {
          const address = addresses[0];
          // Try multiple fields for city
          const city = address.city 
            || address.subAdministrativeArea 
            || address.district 
            || address.name 
            || "";
          // Try multiple fields for state
          const state = address.region 
            || address.administrativeArea 
            || address.subregion 
            || "";
          
          console.log("📍 [LocationService] Extracted from Expo - city:", city, "state:", state);
          
          if (city || state) {
            return { city: city || "", state: state || "" };
          }
        }
      } catch (error) {
        console.error("📍 [LocationService] Expo reverse geocoding error:", error);
      }
    }

    // Fallback to Google Geocoding API
    const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (GOOGLE_API_KEY) {
      try {
        console.log("📍 [LocationService] Using Google reverse geocoding as fallback");
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === "OK" && data.results.length > 0) {
          const result = data.results[0];
          const addressComponents = result.address_components || [];

          let city = "";
          let state = "";

          addressComponents.forEach((component: any) => {
            if (component.types.includes("locality") || component.types.includes("sublocality") || component.types.includes("sublocality_level_1")) {
              if (!city) {
                city = component.long_name;
              }
            } else if (component.types.includes("administrative_area_level_1")) {
              state = component.short_name;
            }
          });

          console.log("📍 [LocationService] Extracted from Google - city:", city, "state:", state);

          // Return if we have at least city or state
          if (city || state) {
            return { city: city || "", state: state || "" };
          }
        }
      } catch (error) {
        console.error("📍 [LocationService] Google reverse geocoding error:", error);
      }
    }

    console.warn("📍 [LocationService] Failed to get city/state from coordinates");
    return null;
  }

  /**
   * Watch location changes
   * Returns a subscription that can be removed
   */
  static async watchPosition(
    callback: (location: LocationCoords) => void
  ): Promise<Location.LocationSubscription | null> {
    if (Platform.OS === "web") return null;

    return await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (location) => {
        callback({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    );
  }
}
