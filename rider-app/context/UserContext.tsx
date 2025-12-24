import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { websocketService } from '@/services/websocket';
import { clearTokens, migrateTokensFromAsyncStorage } from '@/utils/tokenStorage';
import { logger } from '@/utils/logger';

export interface User {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  profilePicture?: string;
  emailVerified?: boolean;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Migrate tokens from AsyncStorage to SecureStore on app startup
    migrateTokensFromAsyncStorage().catch((error) => {
      logger.error('Failed to migrate tokens', error, 'UserContext');
    });
    
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setUserState(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Failed to load user from storage:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setUser = async (newUser: User | null) => {
    try {
      if (newUser) {
        await AsyncStorage.setItem('user', JSON.stringify(newUser));
        setUserState(newUser);
      } else {
        await AsyncStorage.removeItem('user');
        setUserState(null);
      }
    } catch (error) {
      console.error('Failed to save user to storage:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Disconnect WebSocket on logout
      websocketService.disconnect();
      
      // Clear user data from AsyncStorage
      await AsyncStorage.removeItem('user');
      
      // Clear tokens from secure storage
      await clearTokens();
      
      setUserState(null);
      logger.debug('User logged out successfully', undefined, 'UserContext');
    } catch (error) {
      logger.error('Failed to logout', error, 'UserContext');
      throw error;
    }
  };

  return (
    <UserContext.Provider value={{ user, setUser, logout, isLoading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

