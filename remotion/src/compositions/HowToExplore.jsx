import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from 'remotion';

const VIOLET = '#7B5CF0';
const COBALT = '#4B6BF0';
const BG = '#030303';
const GLASS = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.08)';
const MUTED = 'rgba(255,255,255,0.4)';
const SECONDARY = 'rgba(255,255,255,0.7)';

const steps = [
  { num: '1', title: 'Acquire', desc: 'Get your copy from this page. One .nz file — the entire release, packaged.' },
  { num: '2', title: 'Open', desc: 'Drop it into any browser. The experience boots from the file — nothing loads from the internet.' },
  { num: '3', title: 'Explore', desc: 'Play tracks, read lyrics, browse artwork, check credits. All there, offline forever.' },
];

const badges = ['Offline-first', 'No account needed', 'Yours to keep'];

function StepCard({ num, title, desc, delay, active }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 100 } });
  const opacity = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      background: active ? 'rgba(123,92,240,0.08)' : GLASS,
      border: `1px solid ${active ? 'rgba(123,92,240,0.3)' : BORDER}`,
      borderRadius: 14,
      padding: '28px 24px',
      display: 'flex',
      gap: 16,
      transform: `translateX(${(1 - slideIn) * 80}px)`,
      opacity,
      flex: 1,
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${VIOLET}, ${COBALT})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        fontWeight: 800,
        color: '#fff',
        flexShrink: 0,
      }}>
        {num}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{title}</span>
        <span style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>{desc}</span>
      </div>
    </div>
  );
}

function Arrow({ delay }) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame - delay, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const pulse = Math.sin((frame - delay) * 0.08) * 0.3 + 0.7;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 8px',
      opacity: progress * pulse,
    }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M5 12h14M13 6l6 6-6 6" stroke={VIOLET} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function NzFileAnimation() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = spring({ frame: frame - 60, fps, config: { damping: 12, stiffness: 80 } });
  const float = Math.sin(frame * 0.04) * 4;
  const glow = Math.sin(frame * 0.06) * 0.2 + 0.4;

  return (
    <div style={{
      position: 'absolute',
      top: '15%',
      right: 60,
      transform: `scale(${appear}) translateY(${float}px)`,
      opacity: appear,
    }}>
      <div style={{
        width: 100,
        height: 120,
        borderRadius: 12,
        background: `linear-gradient(135deg, ${VIOLET}20, ${COBALT}10)`,
        border: `1px solid ${VIOLET}40`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        boxShadow: `0 0 ${40 + glow * 20}px ${VIOLET}${Math.round(glow * 40).toString(16).padStart(2, '0')}`,
      }}>
        <span style={{ fontSize: 28, fontWeight: 900, color: VIOLET }}>.nz</span>
        <span style={{ fontSize: 9, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase' }}>package</span>
      </div>
    </div>
  );
}

export const HowToExplore = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 20], [30, 0], { extrapolateRight: 'clamp' });
  const subtitleOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: 'clamp' });

  const activeStep = Math.floor(interpolate(frame, [100, 250], [0, 3], { extrapolateRight: 'clamp' }));

  return (
    <AbsoluteFill style={{
      background: BG,
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: 60,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <NzFileAnimation />

      {/* Header */}
      <div style={{ opacity: titleOpacity, transform: `translateY(${titleY}px)` }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: VIOLET,
          marginBottom: 8,
        }}>
          How to explore
        </div>
        <h1 style={{
          fontSize: 42,
          fontWeight: 900,
          color: '#fff',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          margin: 0,
        }}>
          Your .NZ file, unpacked
        </h1>
      </div>

      <div style={{ opacity: subtitleOpacity, marginTop: 12 }}>
        <p style={{ fontSize: 15, color: MUTED, maxWidth: 440, lineHeight: 1.6, margin: 0 }}>
          One file. Everything inside. Here's how it works once it's yours.
        </p>
      </div>

      {/* Steps */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        marginTop: 40,
        maxWidth: 900,
      }}>
        {steps.map((step, i) => (
          <div key={step.num} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <StepCard {...step} delay={50 + i * 25} active={activeStep === i} />
            {i < 2 && <Arrow delay={50 + (i + 1) * 25 - 10} />}
          </div>
        ))}
      </div>

      {/* Format badges */}
      <Sequence from={140}>
        <div style={{
          display: 'flex',
          gap: 10,
          marginTop: 32,
        }}>
          {badges.map((badge, i) => {
            const badgeOpacity = interpolate(frame - 140, [i * 8, i * 8 + 12], [0, 1], { extrapolateRight: 'clamp' });
            return (
              <div key={badge} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                fontWeight: 600,
                color: SECONDARY,
                padding: '8px 16px',
                borderRadius: 99,
                border: `1px solid ${BORDER}`,
                background: 'rgba(255,255,255,0.02)',
                opacity: badgeOpacity,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: VIOLET }} />
                {badge}
              </div>
            );
          })}
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
