import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Text,
  Platform,
} from 'react-native';
import AppText from '../components/AppText';
import OnboardingIllustration, {
  type OnboardingIllustrationVariant,
} from '../components/onboarding/OnboardingIllustrations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { BORDER, PRIMARY, PURPLE_DEEP, TEXT, TEXT_MUTED, TEXT_SECONDARY } from '../theme/design';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ONBOARD_BG = '#F8F9FC';

const ILLUSTRATION_MAX_H = Math.min(SCREEN_HEIGHT * 0.36, 280);

type SlideDef = {
  illustration: OnboardingIllustrationVariant;
  titleBold: string;
  titleRest: string;
  description: string;
};

const SLIDES: SlideDef[] = [
  {
    illustration: 'organized',
    titleBold: 'Stay organized',
    titleRest: 'and take control',
    description:
      'Easily categorize your expenses, manage invoices, and track sales while keeping your finances organized.',
  },
  {
    illustration: 'scan',
    titleBold: 'Scan and capture',
    titleRest: 'details',
    description:
      'Get a clear, real-time view of your expenses, income, and net balance.',
  },
  {
    illustration: 'track',
    titleBold: 'Track your finances',
    titleRest: 'easily',
    description:
      'Snap or upload receipts and sales records, automatically extract data, and build your financial dashboard.',
  },
  {
    illustration: 'ready',
    titleBold: 'Ready when',
    titleRest: 'you are',
    description:
      'Create your account to get started, or log in if you already have one.',
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

  const goNext = () => {
    if (index < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * (index + 1), animated: true });
    }
  };

  const handleSkip = () => {
    onSignUp();
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        bounces={false}
        style={styles.pager}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={[styles.slidePage, { width: SCREEN_WIDTH }]}>
            <ScrollView
              style={styles.slideScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.slideScrollContent}
              bounces={false}
            >
              <View style={styles.slideInner}>
                <View style={styles.illustrationWrap}>
                  <OnboardingIllustration
                    variant={slide.illustration}
                    uid={`slide-${i}`}
                    width={Math.min(SCREEN_WIDTH - 56, 320)}
                    height={ILLUSTRATION_MAX_H}
                  />
                </View>

                <Text style={styles.titleLine}>
                  <Text style={styles.titleBold}>{slide.titleBold}</Text>
                  <Text style={styles.titleRest}> {slide.titleRest}</Text>
                </Text>

                <Text style={styles.description}>{slide.description}</Text>
              </View>
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        {isLast ? (
          <>
            <TouchableOpacity onPress={onSignUp} activeOpacity={0.92} style={styles.gradientWrap}>
              <LinearGradient
                colors={[PRIMARY, PURPLE_DEEP]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.primaryButton}
              >
                <AppText style={styles.primaryButtonText}>Sign up</AppText>
                <Ionicons name="chevron-forward" size={22} color="#fff" style={styles.btnChevron} />
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={onLogIn} activeOpacity={0.8}>
              <Text style={styles.secondaryButtonText}>Already have an account? Log in</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity onPress={goNext} activeOpacity={0.92} style={styles.gradientWrap}>
            <LinearGradient
              colors={[PRIMARY, PURPLE_DEEP]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.primaryButton}
            >
              <AppText style={styles.primaryButtonText}>
                {index === 0 ? 'Get started' : 'Next'}
              </AppText>
              <Ionicons name="chevron-forward" size={22} color="#fff" style={styles.btnChevron} />
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={styles.bottomBar}>
          <TouchableOpacity onPress={handleSkip} hitSlop={12} disabled={isLast}>
            <Text style={[styles.skipText, isLast && styles.skipHidden]}>Skip</Text>
          </TouchableOpacity>
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
          <View style={styles.bottomBarSpacer} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ONBOARD_BG,
  },
  pager: {
    flex: 1,
  },
  slidePage: {
    flex: 1,
  },
  slideScroll: {
    flex: 1,
  },
  slideScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  slideInner: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  illustrationWrap: {
    width: '100%',
    minHeight: ILLUSTRATION_MAX_H,
    maxHeight: ILLUSTRATION_MAX_H + 24,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleLine: {
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 8,
    width: '100%',
  },
  titleBold: {
    fontSize: 26,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
  },
  titleRest: {
    fontSize: 26,
    fontWeight: '400',
    color: TEXT_MUTED,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 16,
    fontWeight: '400',
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 340,
    width: '100%',
    textTransform: 'none',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    backgroundColor: ONBOARD_BG,
  },
  gradientWrap: {
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#5B4CCC',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 28,
    borderRadius: 999,
  },
  btnChevron: {
    marginLeft: 6,
    marginTop: 1,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 4,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: PRIMARY,
    textTransform: 'none',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    minHeight: 36,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    width: 56,
    textTransform: 'none',
  },
  skipHidden: {
    opacity: 0,
  },
  dots: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BORDER,
  },
  dotActive: {
    backgroundColor: PRIMARY,
    width: 28,
    borderRadius: 4,
  },
  bottomBarSpacer: {
    width: 56,
  },
});
