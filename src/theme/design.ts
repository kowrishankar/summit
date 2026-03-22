/**
 * App-wide design tokens (aligned with Reports / Settings visual system).
 */
import { Platform } from 'react-native';

export const PURPLE = '#7B61FF';
export const PURPLE_DEEP = '#5B4CCC';
export const LAVENDER = '#D4D1FF';
export const LAVENDER_SOFT = '#E8E6FF';
export const GREEN = '#22c55e';
export const GREEN_MUTED = '#4ade80';
export const PAGE_BG = '#F5F6FA';
export const CARD_BG = '#FFFFFF';
export const MUTED_CARD = '#F8F9FE';
export const BORDER = '#E8E9F0';
export const TEXT = '#0f172a';
export const TEXT_MUTED = '#64748b';
export const TEXT_SECONDARY = '#94a3b8';
export const RED = '#ef4444';

/** Primary actions, links, active chips */
export const PRIMARY = PURPLE;

/** Navigation / legacy indigo — maps to new purple */
export const INDIGO_LEGACY = '#6366f1';

export const shadowCard = Platform.select({
  ios: {
    shadowColor: '#1e1b4b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  android: { elevation: 3 },
  default: {},
});

export const shadowCardLight = Platform.select({
  ios: {
    shadowColor: '#1e1b4b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
  default: {},
});

export const headerScreenOptions = {
  headerStyle: { backgroundColor: PAGE_BG },
  headerTintColor: TEXT,
  headerShadowVisible: false,
  headerTitleStyle: { fontWeight: '700' as const, color: TEXT },
};
