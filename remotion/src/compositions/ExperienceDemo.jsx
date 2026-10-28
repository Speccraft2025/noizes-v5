import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from 'remotion';

const VIOLET = '#7B5CF0';
const COBALT = '#4B6BF0';
const BG = '#030303';
const GLASS = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.08)';
const MUTED = 'rgba(255,255,255,0.4)';

const sections = [
  { glyph: '◐', label: 'Opening', blurb: 'How the release introduces itself' },
  { glyph: '≡', label: 'Tracklist', blurb: 'Every track, in sequence' },
  { glyph: '¶', label: 'Lyrics', blurb: 'Words, timed to the music' },
  { glyph: '▦', label: 'Gallery', blurb: 'Images packaged with the release' },
  { glyph: '➔', label: 'Guide', blurb: 'How to move through the experience' },
  { glyph: '★', label: 'Credits', blurb: 'Who made it, and what they did' },
];

function SectionCard({ glyph, label, blurb, delay }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 120 } });
  const opacity = interpolate(frame - delay, [0, 8], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      background: GLASS,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      transform: `scale(${scale})`,
      opacity,
    }}>
      <span style={{ fontSize: 22, color: VIOLET }}>{glyph}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{label}</span>
      <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.4 }}>{blurb}</span>
    </div>
  );
}

function GlowOrb({ delay }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = interpolate(frame - delay, [0, 120], [0, 1], { extrapolateRight: 'clamp' });
  const pulse = Math.sin(frame * 0.05) * 0.15 + 0.85;

  return (
    <div style={{
      position: 'absolute',
      width: 300,
      height: 300,
      borderRadius: '50%',
      background: `radial-gradient(circle, ${VIOLET}30, transparent 70%)`,
      filter: 'blur(60px)',
      opacity: progress * pulse * 0.6,
      top: '20%',
      right: '5%',
    }} />
  );
}

export const ExperienceDemo = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 20], [30, 0], { extrapolateRight: 'clamp' });

  const subtitleOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: 'clamp' });

  const browserOpacity = interpolate(frame, [150, 170], [0, 1], { extrapolateRight: 'clamp' });
  const browserScale = spring({ frame: frame - 150, fps, config: { damping: 18, stiffness: 80 } });

  const highlightIndex = Math.floor(interpolate(frame, [180, 280], [0, 6], { extrapolateRight: 'clamp' }));

  return (
    <AbsoluteFill style={{
      background: BG,
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: 60,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <GlowOrb delay={0} />

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
          The Experience
        </div>
        <h1 style={{
          fontSize: 42,
          fontWeight: 900,
          color: '#fff',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          margin: 0,
        }}>
          See how it comes alive
        </h1>
      </div>

      <div style={{ opacity: subtitleOpacity, marginTop: 12 }}>
        <p style={{ fontSize: 15, color: MUTED, maxWidth: 500, lineHeight: 1.6, margin: 0 }}>
          Your browser becomes the player. Every section unfolds from the package itself.
        </p>
      </div>

      {/* Section cards grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        marginTop: 40,
        flex: 1,
        alignContent: 'start',
      }}>
        {sections.map((section, i) => (
          <div key={section.label} style={{
            transform: highlightIndex === i ? 'scale(1.04)' : 'scale(1)',
            transition: 'transform 0.3s',
            boxShadow: highlightIndex === i ? `0 0 30px ${VIOLET}30` : 'none',
            borderRadius: 12,
          }}>
            <SectionCard {...section} delay={40 + i * 12} />
          </div>
        ))}
      </div>

      {/* Animated browser hint */}
      <Sequence from={200}>
        <div style={{
          position: 'absolute',
          bottom: 50,
          right: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          opacity: interpolate(frame - 200, [0, 15], [0, 1], { extrapolateRight: 'clamp' }),
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: VIOLET,
            boxShadow: `0 0 12px ${VIOLET}`,
          }} />
          <span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>
            No app needed. Opens in any browser.
          </span>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
