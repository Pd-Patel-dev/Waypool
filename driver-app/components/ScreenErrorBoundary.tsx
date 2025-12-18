/**
 * Screen-level Error Boundary
 * Wraps individual screens to prevent one screen's error from crashing the entire app
 */

import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface ScreenErrorBoundaryProps {
  children: React.ReactNode;
  screenName?: string;
}

export function ScreenErrorBoundary({ children, screenName }: ScreenErrorBoundaryProps) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // In production, log to error reporting service
        // For now, error is handled by ErrorBoundary component
        if (__DEV__) {
          // In development, we can see the error in the ErrorBoundary UI
        }
      }}
      fallback={
        <ErrorBoundary
          fallback={
            <ErrorBoundary>
              {/* Nested fallback - if ErrorBoundary itself fails, show minimal UI */}
              <div style={{ padding: 20, textAlign: 'center' }}>
                <p>An error occurred in {screenName || 'this screen'}</p>
              </div>
            </ErrorBoundary>
          }
        >
          {children}
        </ErrorBoundary>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

