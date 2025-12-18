import React, { Suspense } from 'react';
import { ScreenErrorBoundary } from '@/components/ScreenErrorBoundary';
import { LazyScreenLoader } from '@/components/LazyScreenLoader';

// Lazy load the screen component for code splitting
const AddRideScreen = React.lazy(() => import('@/screens/AddRideScreen'));

export default function AddRidePage() {
  return (
    <ScreenErrorBoundary screenName="Add Ride">
      <Suspense fallback={<LazyScreenLoader />}>
        <AddRideScreen />
      </Suspense>
    </ScreenErrorBoundary>
  );
}

