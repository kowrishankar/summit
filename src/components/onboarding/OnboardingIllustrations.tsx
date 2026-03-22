import React from 'react';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Circle,
  Ellipse,
  Path,
  G,
  Text as SvgText,
} from 'react-native-svg';
import {
  LAVENDER_SOFT,
  PRIMARY,
  PURPLE_DEEP,
  TEXT_MUTED,
} from '../../theme/design';

export type OnboardingIllustrationVariant = 'organized' | 'scan' | 'track' | 'ready';

type Props = {
  variant: OnboardingIllustrationVariant;
  width: number;
  height: number;
  /** Unique prefix so gradient ids don’t clash when multiple SVGs mount */
  uid: string;
};

type FrameProps = Pick<Props, 'width' | 'height' | 'uid'>;

/**
 * Code-generated illustrations inspired by the onboarding mocks (folders & docs,
 * phone + receipt scan, dashboard receipt) — replaces static PNG assets.
 */
export default function OnboardingIllustration({ variant, width, height, uid }: Props) {
  switch (variant) {
    case 'organized':
      return <IllustrationOrganized width={width} height={height} uid={uid} />;
    case 'scan':
      return <IllustrationScan width={width} height={height} uid={uid} />;
    case 'track':
      return <IllustrationTrack width={width} height={height} uid={uid} />;
    case 'ready':
      return <IllustrationReady width={width} height={height} uid={uid} />;
    default:
      return null;
  }
}

function IllustrationOrganized({ width, height, uid }: FrameProps) {
  const g = `org-${uid}`;
  return (
    <Svg width={width} height={height} viewBox="0 0 300 260" preserveAspectRatio="xMidYMid meet">
      <Defs>
        <RadialGradient id={`${g}-blob`} cx="50%" cy="70%" rx="65%" ry="55%">
          <Stop offset="0%" stopColor={LAVENDER_SOFT} stopOpacity={1} />
          <Stop offset="100%" stopColor="#c4b5fd" stopOpacity={0.35} />
        </RadialGradient>
        <SvgLinearGradient id={`${g}-folder`} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#a5b4fc" />
          <Stop offset="100%" stopColor="#818cf8" />
        </SvgLinearGradient>
        <SvgLinearGradient id={`${g}-doc`} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#ffffff" />
          <Stop offset="100%" stopColor="#f1f5f9" />
        </SvgLinearGradient>
        <SvgLinearGradient id={`${g}-accent`} x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={PRIMARY} />
          <Stop offset="100%" stopColor={PURPLE_DEEP} />
        </SvgLinearGradient>
      </Defs>
      <Ellipse cx={150} cy={195} rx={130} ry={85} fill={`url(#${g}-blob)`} />
      {/* Back folder */}
      <Path
        d="M 52 108 L 52 198 L 168 198 L 168 98 L 118 98 L 98 108 Z"
        fill={`url(#${g}-folder)`}
        opacity={0.92}
      />
      <Path d="M 98 108 L 118 98 L 168 98 L 168 108 Z" fill="#6366f1" opacity={0.5} />
      {/* Document with chart */}
      <G transform="translate(95, 72)">
        <Rect x={0} y={0} width={112} height={140} rx={12} fill={`url(#${g}-doc)`} />
        <Rect x={16} y={18} width={48} height={8} rx={4} fill="#e2e8f0" />
        <Rect x={16} y={34} width={72} height={6} rx={3} fill="#f1f5f9" />
        <Rect x={16} y={52} width={14} height={36} rx={3} fill="#c4b5fd" />
        <Rect x={36} y={62} width={14} height={26} rx={3} fill={PRIMARY} opacity={0.65} />
        <Rect x={56} y={48} width={14} height={40} rx={3} fill="#818cf8" />
        <Rect x={76} y={70} width={14} height={18} rx={3} fill="#94a3b8" />
      </G>
      {/* Front small card */}
      <Rect x={178} y={118} width={72} height={88} rx={14} fill="#ffffff" opacity={0.95} />
      <Circle cx={214} cy={152} r={18} fill={`url(#${g}-accent)`} opacity={0.9} />
      <Path
        d="M 206 152 L 212 158 L 224 146"
        stroke="#ffffff"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Rect x={192} y={178} width={44} height={6} rx={3} fill="#e2e8f0" />
      <Rect x={192} y={190} width={32} height={6} rx={3} fill="#f1f5f9" />
    </Svg>
  );
}

function IllustrationScan({ width, height, uid }: FrameProps) {
  const g = `sc-${uid}`;
  return (
    <Svg width={width} height={height} viewBox="0 0 300 260" preserveAspectRatio="xMidYMid meet">
      <Defs>
        <RadialGradient id={`${g}-blob`} cx="45%" cy="55%" rx="50%" ry="45%">
          <Stop offset="0%" stopColor="#ddd6fe" stopOpacity={0.95} />
          <Stop offset="100%" stopColor={LAVENDER_SOFT} stopOpacity={0.2} />
        </RadialGradient>
        <SvgLinearGradient id={`${g}-phone`} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#334155" />
          <Stop offset="100%" stopColor="#1e293b" />
        </SvgLinearGradient>
      </Defs>
      <Ellipse cx={125} cy={130} rx={105} ry={100} fill={`url(#${g}-blob)`} />
      {/* Phone body */}
      <Rect x={88} y={48} width={124} height={178} rx={22} fill={`url(#${g}-phone)`} />
      <Rect x={96} y={58} width={108} height={152} rx={14} fill="#f8fafc" />
      {/* Receipt */}
      <G transform="translate(118, 78)">
        <Path
          d="M 0 8 L 0 118 L 8 112 L 16 118 L 24 110 L 32 118 L 40 112 L 48 118 L 56 112 L 64 118 L 64 8 Q 64 0 56 0 L 8 0 Q 0 0 0 8 Z"
          fill="#ffffff"
        />
        <Rect x={12} y={14} width={40} height={5} rx={2} fill="#e2e8f0" />
        <SvgText
          x={32}
          y={36}
          fontSize={9}
          fontWeight="600"
          fill={TEXT_MUTED}
          textAnchor="middle"
        >
          Your receipt
        </SvgText>
        <SvgText
          x={32}
          y={58}
          fontSize={16}
          fontWeight="700"
          fill="#ef4444"
          textAnchor="middle"
        >
          -£78.85
        </SvgText>
        <Rect x={12} y={68} width={40} height={4} rx={2} fill="#f1f5f9" />
        <Rect x={12} y={78} width={32} height={4} rx={2} fill="#f1f5f9" />
        <Rect x={12} y={88} width={36} height={4} rx={2} fill="#f1f5f9" />
        <SvgText x={32} y={108} fontSize={8} fill="#94a3b8" textAnchor="middle">
          Expenses
        </SvgText>
      </G>
      {/* Notch hint */}
      <Rect x={142} y={54} width={16} height={4} rx={2} fill="#1e293b" />
    </Svg>
  );
}

function IllustrationTrack({ width, height, uid }: FrameProps) {
  const g = `tr-${uid}`;
  return (
    <Svg width={width} height={height} viewBox="0 0 300 260" preserveAspectRatio="xMidYMid meet">
      <Defs>
        <SvgLinearGradient id={`${g}-paper`} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#e0f2fe" />
          <Stop offset="100%" stopColor="#bae6fd" />
        </SvgLinearGradient>
        <SvgLinearGradient id={`${g}-phone`} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#475569" />
          <Stop offset="100%" stopColor="#1e293b" />
        </SvgLinearGradient>
      </Defs>
      {/* Floating papers */}
      <Rect x={28} y={88} width={56} height={72} rx={10} fill={`url(#${g}-paper)`} opacity={0.85} />
      <Rect x={38} y={100} width={28} height={4} rx={2} fill="#7dd3fc" opacity={0.6} />
      <Rect x={38} y={110} width={36} height={4} rx={2} fill="#e0f2fe" />
      <Rect x={216} y={76} width={52} height={68} rx={10} fill="#dbeafe" opacity={0.9} />
      <Rect x={226} y={88} width={24} height={4} rx={2} fill="#93c5fd" opacity={0.5} />
      <Rect x={226} y={98} width={32} height={4} rx={2} fill="#bfdbfe" />
      {/* Phone */}
      <Rect x={102} y={56} width={96} height={168} rx={18} fill={`url(#${g}-phone)`} />
      <Rect x={108} y={64} width={84} height={146} rx={12} fill="#f0f9ff" />
      <Rect x={118} y={78} width={64} height={100} rx={8} fill="#ffffff" />
      <SvgText x={150} y={98} fontSize={8} fontWeight="600" fill={TEXT_MUTED} textAnchor="middle">
        Your receipt
      </SvgText>
      <SvgText x={150} y={118} fontSize={14} fontWeight="700" fill="#0f172a" textAnchor="middle">
        £16.85
      </SvgText>
      <Rect x={124} y={128} width={52} height={3} rx={1.5} fill="#e2e8f0" />
      <Rect x={124} y={136} width={44} height={3} rx={1.5} fill="#f1f5f9" />
      <Rect x={124} y={144} width={48} height={3} rx={1.5} fill="#f1f5f9" />
      <Rect x={132} y={62} width={36} height={3} rx={1.5} fill="#334155" />
    </Svg>
  );
}

function IllustrationReady({ width, height, uid }: FrameProps) {
  const g = `rd-${uid}`;
  return (
    <Svg width={width} height={height} viewBox="0 0 300 260" preserveAspectRatio="xMidYMid meet">
      <Defs>
        <RadialGradient id={`${g}-glow`} cx="50%" cy="45%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={LAVENDER_SOFT} stopOpacity={1} />
          <Stop offset="70%" stopColor="#c4b5fd" stopOpacity={0.4} />
          <Stop offset="100%" stopColor="#f8f9fc" stopOpacity={0} />
        </RadialGradient>
        <SvgLinearGradient id={`${g}-ring`} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={PRIMARY} />
          <Stop offset="100%" stopColor={PURPLE_DEEP} />
        </SvgLinearGradient>
      </Defs>
      <Circle cx={150} cy={120} r={118} fill={`url(#${g}-glow)`} />
      <Circle cx={150} cy={118} r={56} stroke={`url(#${g}-ring)`} strokeWidth={6} fill="#ffffff" />
      <Path
        d="M 128 118 L 142 132 L 176 98"
        stroke={PRIMARY}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={150} cy={200} r={4} fill="#cbd5e1" />
      <Circle cx={170} cy={196} r={3} fill="#e2e8f0" />
      <Circle cx={130} cy={196} r={3} fill="#e2e8f0" />
    </Svg>
  );
}
