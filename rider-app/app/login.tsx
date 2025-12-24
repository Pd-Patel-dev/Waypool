import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { login, type ApiError } from '@/services/api';
import { useUser } from '@/context/UserContext';
import { API_URL } from '@/config/api';
import * as Device from 'expo-device';
import { logger } from '@/utils/logger';

export default function LoginScreen(): React.JSX.Element {
  const { setUser } = useUser();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    general?: string;
  }>({});

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiInfo, setApiInfo] = useState<string>('');

  // Log API configuration on mount for debugging
  useEffect(() => {
    const deviceInfo = {
      isDevice: Device.isDevice,
      deviceName: Device.deviceName || 'Unknown',
      modelName: Device.modelName || 'Unknown',
      apiUrl: API_URL,
    };
    
    const infoText = `Device: ${deviceInfo.deviceName}\nPhysical: ${deviceInfo.isDevice}\nAPI: ${deviceInfo.apiUrl}`;
    setApiInfo(infoText);
    
    logger.info('Login screen loaded', deviceInfo, 'login');
    console.log('📱 Device Info:', deviceInfo);
  }, []);

  // Test backend connection
  const testConnection = async (): Promise<void> => {
    try {
      logger.info(`Testing connection to: ${API_URL}/health`, undefined, 'login');
      const response = await fetch(`${API_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (response.ok) {
        Alert.alert(
          'Connection Successful',
          `Backend is reachable at:\n${API_URL}\n\nResponse: ${JSON.stringify(result)}`
        );
        logger.info('Connection test successful', result, 'login');
      } else {
        Alert.alert('Connection Failed', `Status: ${response.status}\n${JSON.stringify(result)}`);
        logger.error('Connection test failed', { status: response.status, result }, 'login');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert(
        'Connection Error',
        `Cannot connect to:\n${API_URL}\n\nError: ${errorMessage}\n\nMake sure:\n1. Backend is running\n2. Same Wi-Fi network\n3. IP is correct`
      );
      logger.error('Connection test error', error, 'login');
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (): Promise<void> => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await login({
        email: email.trim(),
        password,
      });

      if (response.success && response.user) {
        // Check if user is a rider (check both isRider flag and role for backward compatibility)
        const isRider = response.user.isRider !== false && 
                       (response.user.role === 'rider' || response.user.isRider === true);
        
        if (!isRider) {
          setErrors({
            general: 'This account is not registered as a rider. Please use the driver app instead.',
          });
          setIsLoading(false);
          return;
        }

        // Save user data to context
        await setUser(response.user);
        
        // Navigate to home screen
        router.replace('/(tabs)');
      }
    } catch (error) {
      const apiError = error as ApiError;
      let errorMessage = apiError.message || 'Invalid email or password. Please try again.';
      
      // Handle specific error cases
      if (apiError.status === 401) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (apiError.status === 0) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (apiError.status && apiError.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      }
      
      setErrors({
        general: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigateToSignup = (): void => {
    router.push('/signup');
  };

  const handleGoBack = (): void => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/welcome');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Back Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleGoBack}
              disabled={isLoading}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>

            <View style={styles.header}>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>
                Sign in to your account to continue riding with Waypool.
              </Text>
            </View>

            {errors.general && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errors.general}</Text>
              </View>
            )}

            {/* Debug Info - Only show in development */}
            {__DEV__ && apiInfo && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>🔍 Debug Info</Text>
                <Text style={styles.debugText}>{apiInfo}</Text>
                <TouchableOpacity
                  style={styles.testButton}
                  onPress={testConnection}
                  activeOpacity={0.7}
                >
                  <Text style={styles.testButtonText}>Test Connection</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="Enter your email"
                  placeholderTextColor="#666"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) {
                      setErrors({ ...errors, email: undefined });
                    }
                  }}
                  editable={!isLoading}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {errors.email && (
                  <Text style={styles.fieldError}>{errors.email}</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={[styles.input, errors.password && styles.inputError]}
                  placeholder="Enter your password"
                  placeholderTextColor="#666"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) {
                      setErrors({ ...errors, password: undefined });
                    }
                  }}
                  editable={!isLoading}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {errors.password && (
                  <Text style={styles.fieldError}>{errors.password}</Text>
                )}
              </View>
            </View>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <Text style={styles.loginButtonText}>Log in</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.signupLink}
                onPress={handleNavigateToSignup}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <Text style={styles.signupLinkText}>
                  Don't have an account? Sign up
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  backButton: {
    marginBottom: 20,
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#CCCCCC',
    lineHeight: 22,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderColor: '#FF3B30',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
  },
  form: {
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  input: {
    height: 56,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A3A3C',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  inputError: {
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  fieldError: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 6,
  },
  debugContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  debugTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  debugText: {
    color: '#999999',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 12,
  },
  testButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
  },
  loginButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: 0.3,
  },
  signupLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  signupLinkText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});

