# Driver App - All Errors and Warnings

## Summary

- **TypeScript Errors:** 58 errors
- **Linter Errors:** 1 error, 46 warnings
- **Total Issues:** 105

---

## 🔴 TypeScript Errors (58)

### Missing Exports from API Service

1. **`app/(tabs)/index.tsx:20`** - `deleteRide` is not exported from `@/services/api`
2. **`app/edit-ride.tsx:20`** - `updateRide` is not exported from `@/services/api`
3. **`app/profile.tsx:21`** - `getProfile` is not exported from `@/services/api`
4. **`app/profile.tsx:28`** - `Profile` type is not exported from `@/services/api`
5. **`app/vehicle.tsx:18`** - `getVehicle`, `updateVehicle`, and `Vehicle` are not exported from `@/services/api`

### Type Mismatches

6. **`app/booking-request.tsx:411`** - `pickupZipCode` does not exist on booking type (appears twice)
7. **`app/booking-request.tsx:458,463,470`** - `booking.ride.pricePerSeat` is possibly `null` (3 errors)
8. **`app/edit-ride.tsx:182`** - `rideData.passengers` is possibly `undefined`
9. **`app/edit-ride.tsx:266`** - `user` is possibly `null`
10. **`app/past-ride-details.tsx:476,498`** - `passenger.riderPhone` is possibly `undefined` (2 errors)
11. **`app/profile.tsx:166`** - Type mismatch: `city` is `string | null` but expected `string | undefined`
12. **`app/profile.tsx:312`** - Parameter `password` implicitly has `any` type
13. **`app/profile.tsx:345`** - Route type mismatch: `"/(auth)/login"` not assignable to expected route type
14. **`app/ride-completion.tsx:228`** - `estimatedTimeMinutes` does not exist on `Ride` type
15. **`app/upcoming-ride-details.tsx:547,549`** - `numberOfSeats` does not exist on `Passenger` type (3 errors)
16. **`app/upcoming-ride-details.tsx:563,586`** - `passenger.riderPhone` is possibly `undefined` (2 errors)

### Missing Style Properties

17. **`app/settings.tsx:148`** - `phoneLink` does not exist on styles object
18. **`app/upcoming-ride-details.tsx:295-303,310-312`** - Missing recurring styles:

- `recurringCard`
- `recurringHeader`
- `recurringTitle`
- `recurringContent`
- `recurringRow`
- `recurringLabel`
- `recurringValue`

### Component Type Errors

19. **`components/MapComponent.native.tsx:75`** - `onError` prop does not exist on `MapView`
20. **`components/MapComponent.native.tsx:75`** - Parameter `error` implicitly has `any` type
21. **`components/NavigationComponent.tsx:443,491`** - Type `string` not assignable to `SFSymbols6_0` (2 errors)
22. **`components/ui/icon-symbol.tsx:16`** - Type conversion error in IconMapping
23. **`hooks/useRideLocation.ts:86`** - Parameter `newLocation` implicitly has `any` type
24. **`i18n/index.ts:1`** - Cannot find module `expo-localization`
25. **`screens/AddRideScreen.tsx:358`** - `RefObject<MapView | null>` not assignable to `RefObject<MapView>`
26. **`screens/CurrentRideScreen.tsx:296,464,573,715`** - `rideData.passengers` is possibly `undefined` (4 errors)
27. **`screens/CurrentRideScreen.tsx:644`** - `backButtonText` does not exist (should be `backButton`)
28. **`screens/CurrentRideScreen.tsx:671`** - `RefObject<MapView | null>` not assignable to `RefObject<MapView>`
29. **`screens/CurrentRideScreen.tsx:675,717`** - `Passenger[] | undefined` not assignable to `Passenger[]` (2 errors)
30. **`screens/CurrentRideScreen.tsx:703,705,706,710,711,712,725`** - Type mismatches with `undefined` vs `null` or `string` (7 errors)
31. **`screens/SignupScreen.tsx:202`** - `carYear` type mismatch: `string` not assignable to `number`
32. **`screens/SignupScreen.tsx:318,331`** - `CustomDropdown` props mismatch: `data` property does not exist (2 errors)
33. **`services/notificationService.ts:8`** - Type mismatch in `NotificationBehavior`
34. **`services/notificationService.ts:250`** - Missing `type` property in `NotificationTriggerInput`

---

## ⚠️ Linter Errors and Warnings (47)

### Critical Error (1)

1. **`app/(tabs)/index.tsx:674`** - Unescaped entity: `'` should be escaped as `&apos;`, `&lsquo;`, `&#39;`, or `&rsquo;`

### React Hooks Warnings (8)

2. **`app/(tabs)/earnings.tsx:55`** - Missing dependency: `fetchEarnings` in `useEffect`
3. **`app/(tabs)/index.tsx:298`** - Missing dependency: `fetchRides` in `useCallback`
4. **`app/past-rides.tsx:41`** - Missing dependency: `fetchPastRides` in `useEffect`
5. **`app/ride-completion.tsx:47`** - Missing dependency: `fetchRideDetails` in `useEffect`
6. **`components/AddressAutocomplete.tsx:101,108,342`** - Missing dependencies in `useEffect` (3 warnings)
7. **`components/NavigationComponent.tsx:331`** - Missing dependency: `fetchDirections` in `useEffect`

### Unused Variables (30)

8. **`app/(tabs)/earnings.tsx:65,67,137`** - `monthlyEarnings`, `totalSeatsBooked`, `formatDate` unused (3 warnings)
9. **`app/(tabs)/inbox.tsx:10`** - `Platform` imported but never used
10. **`app/(tabs)/index.tsx:11,19,53,60,400`** - `Animated`, `MapComponent`, `formatCurrency`, `locationError`, `initialRegion` unused (5 warnings)
11. **`app/(tabs)/menu.tsx:2,10`** - React Native imported multiple times (2 warnings)
12. **`app/booking-history.tsx:19,24`** - `Ride` type and `params` unused (2 warnings)
13. **`app/profile.tsx:24,28,39,101`** - `updateProfilePhoto`, `Profile`, `isUploadingPhoto`, `setIsUploadingPhoto`, `prefsError` unused (5 warnings)
14. **`app/settings.tsx:37,86`** - `loading`, `setLoading`, `error` unused (3 warnings)
15. **`app/upcoming-ride-details.tsx:11,19`** - React Native imported multiple times (2 warnings)
16. **`app/vehicle.tsx:18`** - `Vehicle` type unused
17. **`components/AddressAutocomplete.tsx:7,10,399,400,470`** - `TouchableOpacity`, `Modal`, `streetNumber`, `route`, `countryIndex` unused (5 warnings)
18. **`components/add-ride/RideDetailsForm.tsx:9`** - `IconSymbol` unused
19. **`components/add-ride/RouteMap.tsx:7`** - `PROVIDER_DEFAULT` unused
20. **`components/current-ride/PassengerList.tsx:9,83`** - `Alert`, `isPending` unused (2 warnings)
21. **`components/current-ride/RideMap.tsx:7,10`** - `PROVIDER_DEFAULT`, `IconSymbol` unused (2 warnings)

### Code Style Warnings (8)

22. **`app/(tabs)/index.tsx:28`** - `require()` style import is forbidden
23. **`components/MapComponent.tsx:25,28`** - `require()` style imports forbidden (2 warnings)

---

## 📋 Error Categories

### High Priority (Must Fix)

- Missing API exports (`deleteRide`, `updateRide`, `getProfile`, `getVehicle`, `updateVehicle`)
- Type mismatches causing runtime errors
- Missing style properties
- Missing module (`expo-localization`)

### Medium Priority (Should Fix)

- Null/undefined checks
- Type safety improvements
- React Hooks dependency warnings
- Unescaped entities

### Low Priority (Nice to Fix)

- Unused variables
- Code style warnings
- Duplicate imports

---

## 🔧 Recommended Fixes

### 1. Add Missing API Functions

Add to `services/api.ts`:

- `deleteRide()`
- `updateRide()`
- `getProfile()`
- `getVehicle()`
- `updateVehicle()`
- Export `Profile` and `Vehicle` types

### 2. Fix Type Definitions

- Add `pickupZipCode` to booking type
- Add `estimatedTimeMinutes` to `Ride` type
- Add `numberOfSeats` to `Passenger` type
- Fix `NotificationBehavior` and `NotificationTriggerInput` types

### 3. Add Missing Styles

Add to `upcoming-ride-details.tsx`:

- `recurringCard`, `recurringHeader`, `recurringTitle`
- `recurringContent`, `recurringRow`, `recurringLabel`, `recurringValue`
- `phoneLink` to `settings.tsx`

### 4. Install Missing Package

```bash
npm install expo-localization
```

### 5. Fix Null/Undefined Checks

Add proper null checks and default values for:

- `rideData.passengers`
- `passenger.riderPhone`
- `booking.ride.pricePerSeat`
- `user` object

### 6. Fix Type Conversions

- Convert `carYear` from string to number in `SignupScreen`
- Fix `city` type: use `undefined` instead of `null` or add conversion
- Fix route type in `profile.tsx`

---

**Generated:** $(date)
**Total Issues:** 105 (58 TypeScript errors + 47 linter issues)
