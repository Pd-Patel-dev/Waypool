import React, { Suspense } from 'react';
import { ScreenErrorBoundary } from '@/components/ScreenErrorBoundary';
import { LazyScreenLoader } from '@/components/LazyScreenLoader';

// Lazy load the screen component for code splitting
const LoginScreen = React.lazy(() => import('@/screens/LoginScreen'));

export default function LoginPage() {
  return (
    <ScreenErrorBoundary screenName="Login">
      <Suspense fallback={<LazyScreenLoader />}>
        <LoginScreen />
      </Suspense>
    </ScreenErrorBoundary>
  );
}

