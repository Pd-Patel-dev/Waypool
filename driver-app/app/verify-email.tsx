import React from 'react';
import { ScreenErrorBoundary } from '@/components/ScreenErrorBoundary';
import VerifyEmailScreen from '@/screens/VerifyEmailScreen';

export default function VerifyEmailPage() {
  return (
    <ScreenErrorBoundary screenName="Verify Email">
      <VerifyEmailScreen />
    </ScreenErrorBoundary>
  );
}
