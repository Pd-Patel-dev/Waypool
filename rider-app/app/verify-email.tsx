import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { signup, type ApiError } from '@/services/api';
import { resendOTP } from '@/services/api/emailVerification';
import { useUser } from '@/context/UserContext';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '@/constants/designSystem';
import { logger } from '@/utils/logger';

export default function VerifyEmailScreen(): React.JSX.Element {
  const { setUser } = useUser();
  const params = useLocalSearchParams();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const email = params.email as string;
  const firstName = params.firstName as string;
  const lastName = params.lastName as string;
  const phoneNumber = params.phoneNumber as string;
  const password = params.password as string;

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all 6 digits are entered
    if (newOtp.every(digit => digit !== '') && newOtp.join('').length === 6) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code?: string) => {
    const verificationCode = code || otp.join('');
    
    if (verificationCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-digit verification code');
      return;
    }

    setIsVerifying(true);

    try {
      logger.debug('Verifying email with code', { email, codeLength: verificationCode.length }, 'verify-email');
      
      // Create account - signup route will verify the OTP code
      const response = await signup({
        email: email.trim().toLowerCase(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim(),
        verificationCode: verificationCode.trim(),
      });

      logger.debug('Signup response received', { 
        success: response.success, 
        hasUser: !!response.user,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : []
      }, 'verify-email');

      // Backend wraps response in data object: { success: true, message: "...", data: { user: {...}, tokens: {...} } }
      const isSuccess = response.success === true;
      const user = response.user || response.data?.user;

      if (isSuccess && user) {
        logger.info('Account created successfully', { userId: user.id, email: user.email }, 'verify-email');
        
        // Set user in context
        if (setUser) {
          await setUser(user);
          logger.debug('User set in context', undefined, 'verify-email');
        }

        // Navigate immediately after setting user (don't wait for alert)
        logger.debug('Navigating to tabs', undefined, 'verify-email');
        
        // Use setTimeout to ensure state updates are processed
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 100);

        Alert.alert(
          'Success',
          'Your account has been created successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigation already happened, but this ensures it works if alert is dismissed
                router.replace('/(tabs)');
              },
            },
          ]
        );
      } else {
        logger.error('Signup response missing user or success flag', { 
          response,
          isSuccess,
          hasUser: !!user,
          responseKeys: Object.keys(response)
        }, 'verify-email');
        throw new Error('Account creation failed. Please try again.');
      }
    } catch (error) {
      logger.error('Failed to verify email', error, 'verify-email');
      const apiError = error as ApiError;
      const errorMessage = apiError.message || apiError.errors?.join(', ') || 'Failed to verify email. Please try again.';
      
      Alert.alert('Error', errorMessage, [
        {
          text: 'OK',
          onPress: () => {
            // Clear OTP on error
            setOtp(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
          },
        },
      ]);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || isResending) return;

    setIsResending(true);

    try {
      logger.debug('Resending OTP', { email }, 'verify-email');
      const response = await resendOTP({
        email: email.trim().toLowerCase(),
        fullName: `${firstName.trim()} ${lastName.trim()}`,
      });

      if (response.success) {
        setCountdown(60); // 60 second countdown
        Alert.alert('Success', response.message || 'Verification code has been resent to your email');
        logger.info('OTP resent successfully', { email }, 'verify-email');
      } else {
        throw new Error(response.message || 'Failed to resend code');
      }
    } catch (error) {
      logger.error('Failed to resend OTP', error, 'verify-email');
      const apiError = error as ApiError;
      const errorMessage = apiError.message || 'Failed to resend code. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.7}
              style={styles.backButton}
            >
              <IconSymbol size={24} name="chevron.left" color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Verify Email</Text>
            <View style={styles.backButton} />
          </View>

          {/* Content */}
          <View style={styles.body}>
            <View style={styles.iconContainer}>
              <IconSymbol size={64} name="envelope.fill" color={COLORS.primary} />
            </View>

            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>
              We've sent a 6-digit verification code to{'\n'}
              <Text style={styles.emailText}>{email}</Text>
            </Text>

            {/* OTP Input */}
            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (inputRefs.current[index] = ref)}
                  style={[styles.otpInput, digit && styles.otpInputFilled]}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(index, value)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  editable={!isVerifying}
                />
              ))}
            </View>

            {/* Verify Button */}
            <TouchableOpacity
              style={[
                styles.verifyButton, 
                (isVerifying || otp.some(digit => !digit)) && styles.verifyButtonDisabled
              ]}
              onPress={() => {
                if (!isVerifying && !otp.some(digit => !digit)) {
                  handleVerify();
                }
              }}
              disabled={isVerifying || otp.some(digit => !digit)}
              activeOpacity={0.8}
            >
              {isVerifying ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.verifyButtonText}>Verify</Text>
              )}
            </TouchableOpacity>

            {/* Resend Code */}
            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>Didn't receive the code? </Text>
              <TouchableOpacity
                onPress={handleResend}
                disabled={countdown > 0 || isResending}
                activeOpacity={0.7}
              >
                {isResending ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Text style={[styles.resendLink, countdown > 0 && styles.resendLinkDisabled]}>
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  body: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xxl,
    lineHeight: 22,
  },
  emailText: {
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  otpInput: {
    flex: 1,
    height: 64,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  otpInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  verifyButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.base,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  resendLink: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    color: COLORS.primary,
  },
  resendLinkDisabled: {
    color: COLORS.textTertiary,
  },
});

