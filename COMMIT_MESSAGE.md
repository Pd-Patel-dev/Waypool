feat: Enhance driver ride management and fix date selection issues

Major improvements to driver app functionality and backend validation:

## Driver App Enhancements

### Current Ride Screen Improvements
- Add "Arrived at Pickup" button when driver is within 50m of pickup location
- Display ETA and distance for each passenger and next stop
- Add route progress percentage with distance covered indicator
- Implement emergency/help button during active rides
- Add offline mode detection with network status monitoring
- Optimize location updates (10s interval, 50m threshold) to reduce battery usage
- Show passenger contact info with clickable call and message buttons
- Add cancel ride functionality during active rides

### Ride Creation Fixes
- Fix date picker to allow selecting future dates (use midnight as minimum)
- Add validation to prevent past date/time selections
- Improve date picker handlers for both Android and iOS

### UI/UX Improvements
- Add call and message buttons throughout ride details screens
- Integrate native phone dialer and SMS app for passenger contact
- Improve ride status indicators and filtering
- Add route progress visualization

## Backend Validation Fixes

### Ride Creation Logic
- Allow multiple scheduled rides for different dates
- Only block new rides when driver has in-progress ride (not scheduled)
- Maintain duplicate ride detection for same date/route/time
- Improve date/time validation and error messages

### Database & API
- Update Prisma schema with proper model names (users, rides, bookings)
- Fix relation references throughout backend routes
- Improve error handling and validation messages

## Technical Improvements
- Remove WebSocket messaging system (replaced with native SMS/call)
- Add network status monitoring with @react-native-community/netinfo
- Optimize location tracking to only update on significant movement
- Improve error handling and user feedback

## Files Changed
- Backend: routes, schema, validation logic
- Driver App: CurrentRideScreen, AddRideScreen, ride details screens
- Rider App: tracking screen, booking details
- Services: API endpoints, location tracking

This update significantly improves the driver experience with better ride management,
real-time tracking features, and fixes the critical issue preventing drivers from
creating rides for different dates.

