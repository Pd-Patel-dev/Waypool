import React, { Suspense } from 'react';
import { ScreenErrorBoundary } from '@/components/ScreenErrorBoundary';
import { LazyScreenLoader } from '@/components/LazyScreenLoader';

// Lazy load the screen component for code splitting
const SignupScreen = React.lazy(() => import('@/screens/SignupScreen'));

export default function SignupPage() {
  return (
    <ScreenErrorBoundary screenName="Signup">
      <Suspense fallback={<LazyScreenLoader />}>
        <SignupScreen />
      </Suspense>
    </ScreenErrorBoundary>
  );
}

