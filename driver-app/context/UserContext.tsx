import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logout as apiLogout } from '@/services/api';
import { getAccessToken, clearTokens } from '@/utils/tokenStorage';

interface User {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  emailVerified?: boolean;
  photoUrl: string | null;
  city: string | null;
  carMake: string | null;
  carModel: string | null;
  carYear: number | null;
  carColor: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => Promise<void>;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}

// Create context with a default value to avoid undefined during hot reload
const defaultContextValue: UserContextType = {
  user: null,
  setUser: async () => {},
  isAuthenticated: false,
  logout: async () => {},
};

const UserContext = createContext<UserContextType>(defaultContextValue);

const USER_STORAGE_KEY = '@waypool_user';

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from storage on mount and check token
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      // Check if access token exists - if not, user is not authenticated
      const accessToken = await getAccessToken();
      if (!accessToken) {
        // No token means user is not logged in, clear any stale user data
        await AsyncStorage.removeItem(USER_STORAGE_KEY);
        setUserState(null);
        setIsLoading(false);
        return;
      }

      // Load user data from storage
      const userData = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (userData) {
        const parsed = JSON.parse(userData);
        // Ensure user.id is always a number
        if (parsed && typeof parsed.id !== 'number') {
          parsed.id = typeof parsed.id === 'string' ? parseInt(parsed.id, 10) : Number(parsed.id);
          if (isNaN(parsed.id)) {
            // If conversion fails, don't load invalid user data
            await AsyncStorage.removeItem(USER_STORAGE_KEY);
            await clearTokens();
            setUserState(null);
            setIsLoading(false);
            return;
          }
        }
        // Normalize emailVerified to boolean (default to false if undefined)
        if (parsed) {
          parsed.emailVerified = parsed.emailVerified ?? false;
        }
        setUserState(parsed);
      } else if (accessToken) {
        // Token exists but no user data - inconsistent state, clear tokens
        await clearTokens();
        setUserState(null);
      }
    } catch (error) {
      // On error, clear potentially corrupted data
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      await clearTokens();
      setUserState(null);
    } finally {
      setIsLoading(false);
    }
  };

  const setUser = async (userData: User | null) => {
    try {
      if (userData) {
        // Ensure user.id is always a number before storing
        const normalizedUser: User = {
          ...userData,
          id: typeof userData.id === 'string' ? parseInt(userData.id, 10) : Number(userData.id),
          emailVerified: userData.emailVerified ?? false,
        };
        
        // Validate that id is a valid number
        if (isNaN(normalizedUser.id)) {
          throw new Error('Invalid user ID');
        }

        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(normalizedUser));
        setUserState(normalizedUser);
      } else {
        await AsyncStorage.removeItem(USER_STORAGE_KEY);
        setUserState(null);
      }
    } catch (error) {
      // On error, clear potentially corrupted data
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      setUserState(null);
    }
  };

  const logout = async () => {
    try {
      // Call backend logout endpoint (it will clear tokens)
      await apiLogout();
    } catch (error) {
      // Even if backend call fails, clear local storage and tokens
      await clearTokens();
    } finally {
      // Always clear local user data and tokens
      await clearTokens();
      await setUser(null);
    }
  };

  // Always provide context value, even during loading
  // This ensures child components can always access the context
  const contextValue: UserContextType = {
    user,
    setUser,
    isAuthenticated: !!user,
    logout,
  };

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  // Context is always defined now (has default value)
  // During hot reload, React might use the default value temporarily
  // This is safe - the provider will re-render with the actual value
  return context;
}

