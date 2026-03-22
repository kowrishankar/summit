import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StripeProvider } from '@stripe/stripe-react-native';
import StripeDeepLinkHandler from './src/components/StripeDeepLinkHandler';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { AppProvider } from './src/contexts/AppContext';
import AuthStack from './src/navigation/AuthStack';
import MainTabs from './src/navigation/MainTabs';
import SubscribeScreen from './src/screens/SubscribeScreen';
import SplashScreen from './src/components/SplashScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { isStripePublishableKeyConfigured } from './src/config/stripeEnv';

const publishableKey = (process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '').trim();
const stripeEnabled = isStripePublishableKeyConfigured();
const ONBOARDING_SEEN_KEY = 'summit_onboarding_seen';

function RootNavigator() {
  const { user, loading, hasActiveSubscription } = useAuth();
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);
  const [initialAuthRoute, setInitialAuthRoute] = useState<'Login' | 'Signup'>('Login');

  useEffect(() => {
    if (user) return;
    (async () => {
      const seen = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
      setOnboardingSeen(seen === 'false'); // TODO: set it to true
    })();
  }, [user]);

  const handleOnboardingSignUp = async () => {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
    setOnboardingSeen(true);
    setInitialAuthRoute('Signup');
  };

  const handleOnboardingLogIn = async () => {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
    setOnboardingSeen(true);
    setInitialAuthRoute('Login');
  };

  if (loading) {
    return <SplashScreen />;
  }

  if (!user) {
    if (onboardingSeen === null) {
      return <SplashScreen />;
    }
    if (onboardingSeen === false) {
      return (
        <OnboardingScreen
          onSignUp={handleOnboardingSignUp}
          onLogIn={handleOnboardingLogIn}
        />
      );
    }
    return <AuthStack initialRouteName={initialAuthRoute} />;
  }

  if (!hasActiveSubscription) {
    return <SubscribeScreen />;
  }

  return (
    <AppProvider>
      <MainTabs />
    </AppProvider>
  );
}

function AppNavigation() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
        <StatusBar style="light" />
      </NavigationContainer>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        {stripeEnabled ? (
          <StripeProvider publishableKey={publishableKey}>
            <StripeDeepLinkHandler />
            <AppNavigation />
          </StripeProvider>
        ) : (
          <AppNavigation />
        )}
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

