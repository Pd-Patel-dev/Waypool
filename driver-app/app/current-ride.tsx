import React, { Suspense } from 'react';
import { ScreenErrorBoundary } from '@/components/ScreenErrorBoundary';
import { LazyScreenLoader } from '@/components/LazyScreenLoader';

// Lazy load the screen component for code splitting
const CurrentRideScreen = React.lazy(() => import('@/screens/CurrentRideScreen'));

export default function CurrentRidePage() {
  return (
    <ScreenErrorBoundary screenName="Current Ride">
      <Suspense fallback={<LazyScreenLoader />}>
        <CurrentRideScreen />
      </Suspense>
    </ScreenErrorBoundary>
  );
}

