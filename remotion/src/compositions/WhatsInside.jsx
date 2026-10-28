import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from 'remotion';

const VIOLET = '#7B5CF0';
const COBALT = '#4B6BF0';
const BG = '#030303';
const GLASS = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.08)';
const MUTED = 'rgba(255,255,255,0.4)';

const contents = [
  { icon: '♫', label: 'Audio', detail: '1 track · 1 minute' },
  { icon: '▣', label: 'Artwork', detail: '3 images · including the release cover' },
  { icon: '¶', label: 'Lyrics', detail: 'Synced lyrics for 1 track' },
  { icon: '◈', label: 'Metadata', detail: 'Full credits and rights documentation' },
  { icon: '⊕', label: 'Authenticity', detail: 'Signed component checksum inventory' },
];

function ContentRow({ icon, label, detail, delay, highlight }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 100 } });
  const opacity = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 16,
      padding: '18px 22px',
      borderRadius: 12,
      background: highlight ? 'rgba(123,92,240,0.06)' : GLASS,
      border: `1px solid ${highlight ? 'rgba(123,92,240,0.25)' : BORDER}`,
      transform: `translateY(${(1 - slideIn) * 40}px)`,
      opacity,
    }}>
      <span style={{ fontSize: 20, color: VIOLET, flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{label}</span>
        <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.4 }}>{detail}</span>
      </div>
    </div>
  );
}

function PackageVisual() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = spring({ frame: frame - 30, fps, config: { damping: 15, stiffness: 80 } });
  const rotation = interpolate(frame, [30, 300], [0, 360], { extrapolateRight: 'clamp' });

  const ringOpacity = interpolate(frame, [60, 80], [0, 0.3], { extrapolateRight: 'clamp' });
  const ring2Opacity = interpolate(frame, [80, 100], [0, 0.2], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      right: 80,
      transform: `translateY(-50%) scale(${appear})`,
      opacity: appear,
    }}>
      {/* Outer ring */}
      <div style={{
        position: 'absolute',
        width: 220,
        height: 220,
        top: -40,
        left: -40,
        borderRadius: '50%',
        border: `1px solid ${VIOLET}`,
        opacity: ring2Opacity,
        transform: `rotate(${-rotation * 0.3}deg)`,
      }} />
      {/* Inner ring */}
      <div style={{
        position: 'absolute',
        width: 180,
        height: 180,
        top: -20,
        left: -20,
        borderRadius: '50%',
        border: `1px dashed ${COBALT}`,
        opacity: ringOpacity,
        transform: `rotate(${rotation * 0.5}deg)`,
      }} />
      {/* Core */}
      <div style={{
        width: 140,
        height: 140,
        borderRadius: 20,
        background: `linear-gradient(135deg, ${VIOLET}15, ${COBALT}10)`,
        border: `1px solid ${VIOLET}30`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        boxShadow: `0 0 60px ${VIOLET}15`,
      }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: VIOLET, letterSpacing: '0.05em' }}>.NZ</span>
        <span style={{ fontSize: 9, color: MUTED, letterSpacing: '0.12em', textTransform: 'uppercase' }}>7.8 MB</span>
        <span style={{ fontSize: 8, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>one file</span>
      </div>
    </div>
  );
}

function CheckmarkAnimation({ delay }) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame - delay, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  if (progress <= 0) return null;

  return (
    <div style={{
      position: 'absolute',
      right: -8,
      top: -8,
      width: 24,
      height: 24,
      borderRadius: '50%',
      background: '#22c55e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transform: `scale(${progress})`,
      boxShadow: '0 2px 8px rgba(34,197,94,0.3)',
    }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2.5 6L5 8.5L9.5 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export const WhatsInside = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 20], [30, 0], { extrapolateRight: 'clamp' });
  const subtitleOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: 'clamp' });

  const highlightIndex = Math.floor(interpolate(frame, [150, 270], [0, 5], { extrapolateRight: 'clamp' }));
  const checkCount = Math.floor(interpolate(frame, [160, 280], [0, 5], { extrapolateRight: 'clamp' }));

  return (
    <AbsoluteFill style={{
      background: BG,
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: 60,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <PackageVisual />

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
          What's inside
        </div>
        <h1 style={{
          fontSize: 42,
          fontWeight: 900,
          color: '#fff',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          margin: 0,
        }}>
          The complete package
        </h1>
      </div>

      <div style={{ opacity: subtitleOpacity, marginTop: 12 }}>
        <p style={{ fontSize: 15, color: MUTED, maxWidth: 440, lineHeight: 1.6, margin: 0 }}>
          Everything listed here is in the .nz file. If it's on this list, the package contains it.
        </p>
      </div>

      {/* Content rows */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        marginTop: 36,
        maxWidth: 520,
      }}>
        {contents.map((row, i) => (
          <div key={row.label} style={{ position: 'relative' }}>
            <ContentRow {...row} delay={50 + i * 15} highlight={highlightIndex === i} />
            <CheckmarkAnimation delay={160 + i * 24} />
          </div>
        ))}
      </div>

      {/* Verified badge */}
      <Sequence from={250}>
        <div style={{
          position: 'absolute',
          bottom: 50,
          left: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          opacity: interpolate(frame - 250, [0, 15], [0, 1], { extrapolateRight: 'clamp' }),
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 12px rgba(34,197,94,0.5)',
          }} />
          <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>
            Every component verified. Nothing assumed.
          </span>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
