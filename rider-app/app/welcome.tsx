import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('@/assets/images/Waypool-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Title */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Welcome to Waypool</Text>
          <Text style={styles.heroSubtitle}>
            Your ride-sharing companion
          </Text>
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.signupButton}
            onPress={() => router.push('/signup')}
          >
            <Text style={styles.signupButtonText}>Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: 50,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingVertical: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 60,
  },
  logo: {
    width: width * 0.95,
    height: 200,
    tintColor: '#FFFFFF',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
  },
  spacer: {
    flex: 1,
  },
  buttonContainer: {
    marginBottom: 40,
  },
  signupButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  signupButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  loginButton: {
    width: '100%',
    height: 56,
    backgroundColor: 'transparent',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

