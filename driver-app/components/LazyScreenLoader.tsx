/**
 * Lazy Screen Loader Component
 * Provides a loading indicator for lazy-loaded screens
 * Now uses standardized LoadingScreen component
 */

import React from 'react';
import { LoadingScreen } from './LoadingScreen';

export function LazyScreenLoader(): React.JSX.Element {
  return <LoadingScreen message="Loading screen..." />;
}

