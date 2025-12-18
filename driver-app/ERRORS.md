# Driver App - All Errors and Issues

**Generated:** $(date)  
**Project:** Waypool Driver App  
**Total Issues:** 58 TypeScript Errors

---

## 🔴 TypeScript Errors (58)

### 1. Type Mismatch Errors

#### 1.1 Timeout Type Error

- **File:** `app/(tabs)/index.tsx:183`
- **Error:** `Type 'number' is not assignable to type 'Timeout'`
- **Issue:** setTimeout returns a number in browser/React Native, but TypeScript expects Timeout type
- **Fix:** Use `ReturnType<typeof setTimeout>` or cast to `any` for React Native compatibility

#### 1.2 TextInput onBlur Type Errors (5 errors)

- **File:** `app/profile.tsx`
- **Lines:** 451, 470, 491, 510
- **Error:** `Type '(value: string) => void' is not assignable to type '(e: BlurEvent) => void'`
- **Issue:** onBlur handler expects BlurEvent but receiving string
- **Fix:** Update handlers to accept `BlurEvent` or use `onBlur={(e) => handler(e.nativeEvent.text)}`

---

### 2. Missing Exports / Undefined Names (18 errors)

#### 2.1 Missing Component: InlineLoader

- **File:** `app/booking-history.tsx:170`
- **Error:** `Cannot find name 'InlineLoader'`
- **Issue:** Component is referenced but not imported or doesn't exist
- **Fix:** Import InlineLoader or create/replace with existing loading component

#### 2.2 Missing Function: calculateRideEarnings

- **File:** `app/past-rides.tsx:163`
- **Error:** `Cannot find name 'calculateRideEarnings'`
- **Issue:** Function is called but not defined or imported
- **Fix:** Import from utils or implement the function

#### 2.3 Missing Function: getUserFriendlyErrorMessage (Multiple)

- **Files:**
  - `app/profile.tsx:118, 183`
  - `app/vehicle.tsx:122`
- **Error:** `Cannot find name 'getUserFriendlyErrorMessage'`
- **Issue:** Function is used but not imported
- **Fix:** Import from `@/utils/errorHandler` or `@/utils/errorHandler.ts`

#### 2.4 Missing Functions: validateAll, createFieldChangeHandler, createFieldBlurHandler

- **File:** `app/vehicle.tsx`
- **Lines:** 72, 197, 199, 218, 220, 238, 240
- **Errors:**
  - `Cannot find name 'validateAll'`
  - `Cannot find name 'createFieldChangeHandler'`
  - `Cannot find name 'createFieldBlurHandler'`
- **Issue:** Utility functions are missing or not imported
- **Fix:** Import from validation utilities or implement these helper functions

#### 2.5 Missing Export: validateTime

- **File:** `hooks/useFormValidation.ts:16`
- **Error:** `'"@/utils/validation"' has no exported member named 'validateTime'. Did you mean 'validateDate'?`
- **Issue:** validateTime doesn't exist in validation utils
- **Fix:** Use validateDate or implement validateTime function

#### 2.6 Missing Platform Import

- **File:** `services/notificationService.ts:100`
- **Error:** `Cannot find name 'Platform'`
- **Issue:** Platform is used but not imported from 'react-native'
- **Fix:** Add `import { Platform } from 'react-native';`

---

### 3. Type Safety Errors (35 errors)

#### 3.1 Error Handler Type Errors (28 errors)

- **File:** `utils/errorHandler.ts`
- **Issue:** Multiple properties don't exist on type '{}'
- **Errors:**
  - Lines 36, 38, 41, 48, 51, 60, 68, 71, 79, 82, 83, 90, 93, 95, 97, 103, 111: Property 'message', 'status', or 'errors' does not exist on type '{}'
  - Lines 82, 83, 103: 'error' is of type 'unknown'
- **Root Cause:** Error objects are typed as `{}` instead of proper error types
- **Fix:**

  ```typescript
  // Change from:
  function parseApiError(error: {}): AppError;

  // To:
  function parseApiError(error: unknown): AppError {
    const err = error as {
      message?: string;
      status?: number;
      errors?: string[];
    };
    // ... rest of function
  }
  ```

#### 3.2 API Retry Type Errors (10 errors)

- **File:** `utils/apiRetry.ts`
- **Lines:** 72, 73, 91, 96, 101, 106
- **Error:** Property 'status' or 'message' does not exist on type '{}'
- **Issue:** Error objects need proper typing
- **Fix:** Type error objects properly or use type guards

#### 3.3 useFormValidation Type Error

- **File:** `hooks/useFormValidation.ts:191`
- **Error:** `Argument of type 'string | number | null | undefined' is not assignable to parameter of type 'string | number'`
- **Issue:** Function doesn't handle null/undefined values
- **Fix:** Add null checks or update function signature to accept null/undefined

---

### 4. Component Type Errors (4 errors)

#### 4.1 CachedImage Component Errors

- **File:** `components/CachedImage.tsx`
- **Errors:**
  - Line 130: `Type 'number | ImageSource | ImageSource[] | {...}' is not assignable to type 'ImageSource'`
  - Line 182: `Type '"scaleDown"' is not assignable to type 'ImageContentFit | undefined'. Did you mean '"scale-down"'?`
  - Line 183: `Type 'number | boolean' is not assignable to type 'number | ImageTransition | null | undefined'`
  - Line 187: `Type '(error: Error) => void' is not assignable to type '(event: ImageErrorEventData) => void'`
- **Fixes:**
  1. Fix ImageSource type - ensure single ImageSource, not union
  2. Change `"scaleDown"` to `"scale-down"`
  3. Fix transition prop - ensure it's number or ImageTransition, not boolean
  4. Update error handler to accept `ImageErrorEventData` instead of `Error`

---

## 📋 Error Summary by Category

| Category                | Count  | Files Affected |
| ----------------------- | ------ | -------------- |
| Type Mismatches         | 6      | 2 files        |
| Missing Exports/Imports | 18     | 6 files        |
| Type Safety Issues      | 35     | 3 files        |
| Component Type Errors   | 4      | 1 file         |
| **Total**               | **58** | **12 files**   |

---

## 🔧 Recommended Fixes (Priority Order)

### High Priority (Blocks Compilation)

1. **Fix errorHandler.ts type errors** (28 errors)

   - Update function signatures to properly type error parameters
   - Use type guards for unknown error types

2. **Fix apiRetry.ts type errors** (10 errors)

   - Properly type error objects in retry logic

3. **Add missing imports** (5 errors)

   - Import Platform in notificationService.ts
   - Import getUserFriendlyErrorMessage in profile.tsx and vehicle.tsx

4. **Fix missing functions/components** (7 errors)
   - Implement or import: InlineLoader, calculateRideEarnings, validateAll, createFieldChangeHandler, createFieldBlurHandler
   - Fix validateTime export issue

### Medium Priority (Type Safety)

5. **Fix TextInput onBlur handlers** (5 errors)

   - Update handlers to match React Native TextInput API

6. **Fix CachedImage component types** (4 errors)

   - Update prop types to match expo-image API

7. **Fix useFormValidation null handling** (1 error)
   - Add null/undefined checks

### Low Priority (Minor Issues)

8. **Fix setTimeout type** (1 error)
   - Use proper type for setTimeout return value

---

## 📝 Detailed Fix Recommendations

### Fix 1: errorHandler.ts

```typescript
// Current (causing errors):
export function parseApiError(error: {}): AppError;

// Fixed:
export function parseApiError(error: unknown): AppError {
  // Type guard
  const isErrorWithMessage = (err: unknown): err is { message: string } => {
    return typeof err === "object" && err !== null && "message" in err;
  };

  const isApiError = (
    err: unknown
  ): err is { message?: string; status?: number; errors?: string[] } => {
    return typeof err === "object" && err !== null;
  };

  if (!isApiError(error)) {
    return {
      code: ErrorCode.UNKNOWN_ERROR,
      message: "Unknown error",
      userMessage: "An unexpected error occurred. Please try again.",
      recoverable: true,
      retryable: false,
    };
  }

  // Now TypeScript knows error has message, status, errors properties
  // ... rest of function
}
```

### Fix 2: apiRetry.ts

```typescript
// Add proper error type
interface ApiError {
  message?: string;
  status?: number;
}

// Type guard
function isApiError(error: unknown): error is ApiError {
  return typeof error === "object" && error !== null;
}

// Use in retry logic
if (isApiError(error)) {
  if (error.status === 401) {
    // ...
  }
}
```

### Fix 3: Missing Imports

```typescript
// notificationService.ts
import { Platform } from "react-native";

// profile.tsx and vehicle.tsx
import { getUserFriendlyErrorMessage } from "@/utils/errorHandler";
```

---

## 🎯 Next Steps

1. Fix all High Priority errors first (blocks compilation)
2. Run `npx tsc --noEmit` to verify fixes
3. Fix Medium Priority errors for better type safety
4. Address Low Priority issues for code quality

---

## 📊 Error Distribution

```
errorHandler.ts:     28 errors (48%)
apiRetry.ts:         10 errors (17%)
vehicle.tsx:          7 errors (12%)
profile.tsx:          5 errors (9%)
CachedImage.tsx:      4 errors (7%)
Other files:          4 errors (7%)
```
