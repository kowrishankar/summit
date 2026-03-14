import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
  {
    icon: 'document-text-outline' as const,
    title: 'Track invoices & sales',
    description: 'Upload receipts or add them manually. We extract amounts, dates and details so you can search and report in one place.',
  },
  {
    icon: 'business-outline' as const,
    title: 'Multiple businesses',
    description: 'Run more than one business from a single account. Switch between them in one tap and keep everything organised.',
  },
  {
    icon: 'bar-chart-outline' as const,
    title: 'Spend and income at a glance',
    description: 'See totals by week, month and year. Filter by category and use the data for tax and budgets.',
  },
];

interface OnboardingScreenProps {
  onSignUp: () => void;
  onLogIn: () => void;
}

export default function OnboardingScreen({ onSignUp, onLogIn }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (i !== index) setIndex(i);
  };

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        bounces={false}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View style={styles.iconWrap}>
              <Ionicons name={slide.icon} size={64} color="#818cf8" />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.description}>{slide.description}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === index && styles.dotActive]}
          />
        ))}
      </View>

      <View style={styles.footer}>
        {isLast ? (
          <>
            <TouchableOpacity style={styles.primaryButton} onPress={onSignUp} activeOpacity={0.8}>
              <Text style={styles.primaryButtonText}>Sign up</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={onLogIn} activeOpacity={0.8}>
              <Text style={styles.secondaryButtonText}>Already have an account? Log in</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.nextButton}
            onPress={() => scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * (index + 1), animated: true })}
            activeOpacity={0.8}
          >
            <Text style={styles.nextButtonText}>Next</Text>
            <Ionicons name="arrow-forward" size={20} color="#0f172a" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  slide: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(129, 140, 248, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#334155',
  },
  dotActive: {
    backgroundColor: '#818cf8',
    width: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#818cf8',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    color: '#94a3b8',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#818cf8',
    paddingVertical: 16,
    borderRadius: 12,
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
});
