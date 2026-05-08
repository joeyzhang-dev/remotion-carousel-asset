import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
} from 'remotion';

// ─── Edit this list to control which apps appear and their order ──────────
// bg is the card fill — only shows if the icon has transparent edges or is
// still loading.
type App = {
  name: string;
  icon: string;  // filename inside public/icons/
  bg: string;    // card background color
};
const APPS: App[] = [
  { name: 'Uber',     icon: 'uber.png',     bg: '#000000' },
  { name: 'Flights',  icon: 'flights.png',  bg: '#000000' },
  { name: 'Meet',     icon: 'meet.png',     bg: '#ffffff' },
  { name: 'Gmail',    icon: 'gmail.png',    bg: '#ffffff' },
  { name: 'DoorDash', icon: 'doordash.png', bg: '#ff3008' },
];

// ─── Tuning knobs ─────────────────────────────────────────────────────────
const FRAMES_PER_APP = 90;          // 1.5s at 60fps — match this to your beat
const CARD_SIZE = 360;              // px, focused card size
const WHEEL_RADIUS = 720;           // px — bigger = flatter wheel, smaller = tighter curve
const ANGLE_PER_APP = 44;           // degrees between adjacent cards on the wheel
const VISIBLE_CARDS_EACH_SIDE = 3;  // how many cards above/below to render
const VERTICAL_ANCHOR = 0.5;        // 0=top, 0.5=center, 1=bottom

// Compute the eased "focus" position for a given frame. Pulled out so we can
// sample at frame and frame-1 to derive angular velocity for motion blur.
const focusAt = (f: number, fps: number) => {
  if (f < 0) f = 0;
  const settled = spring({
    frame: f % FRAMES_PER_APP,
    fps,
    config: { damping: 18, stiffness: 90, mass: 0.6 },
  });
  return Math.floor(f / FRAMES_PER_APP) + settled;
};

export const AppCarousel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const easedFocus = focusAt(frame, fps);

  // Angular velocity for motion blur: how fast did focus change between the
  // previous frame and this one, in "apps-per-frame". The spring snap peaks
  // shortly after a transition starts, then decays to ~0 — so blur naturally
  // smears at the start of each snap and resolves to crisp at the end.
  const focusVelocity = Math.abs(easedFocus - focusAt(frame - 1, fps));

  return (
    <AbsoluteFill
      style={{
        background: '#00FF00',  // chroma-key green — keyed out in CapCut
        perspective: 1800,
        perspectiveOrigin: '50% 50%',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d',
        }}
      >
        {APPS.map((app, i) => {
          // Signed distance from focus, wrapped so the carousel loops infinitely
          const n = APPS.length;
          let distance = i - easedFocus;
          distance = (((distance + n / 2) % n) + n) % n - n / 2;

          const abs = Math.abs(distance);
          if (abs > VISIBLE_CARDS_EACH_SIDE + 0.5) return null;

          // Wheel geometry: each card sits at angle θ on a wheel whose axis is
          // horizontal and centered behind the camera. Focused card is at θ=0,
          // i.e. the front of the wheel. Cards above/below curve back and away
          // symmetrically, so the stack reads as the front face of a turning wheel.
          const theta = distance * ANGLE_PER_APP;        // degrees
          const rad   = (theta * Math.PI) / 180;
          const y     = Math.sin(rad) * WHEEL_RADIUS;
          const z     = (Math.cos(rad) - 1) * WHEEL_RADIUS; // 0 at front, negative as it curves back
          const rotX  = -theta;                              // card faces camera tangent to the wheel

          // Depth-driven visuals — keyed off cosθ so they track real distance
          // from camera, not just index distance. Apple-coded restraint: keep
          // far cards sharp, just dim them. Subtle depth blur only for cards
          // very far from focus; foreground/near-focus stay crisp.
          const depth   = 1 - Math.cos(rad);  // 0 at focus, grows as card recedes
          const opacity = interpolate(depth, [0, 0.5, 1.2], [1.0, 0.55, 0.0], { extrapolateRight: 'clamp' });
          const blur    = interpolate(depth, [0, 0.6, 1.2], [0, 0, 6],         { extrapolateRight: 'clamp' });

          // Focus magnify — Gaussian bump that peaks at the focused card and
          // decays sharply. Non-linear so neighbors don't get half-magnified;
          // only the truly-centered card swells up.
          const MAGNIFY_PEAK = 1.32;     // 1.0 = baseline; bump to taste
          const MAGNIFY_FALLOFF = 4.5;   // higher = sharper peak, faster decay
          const focusBump = Math.exp(-MAGNIFY_FALLOFF * abs * abs); // 0..1, 1 at focus
          const magnify = 1 + (MAGNIFY_PEAK - 1) * focusBump;

          // Velocity-based motion blur — restored to original intensity.
          // Multiplied by fps so the visual blur is the same regardless of fps:
          // at 60fps each frame's delta is half as large, so we double the gain.
          const VELOCITY_BLUR_GAIN = 6;  // px of blur per (app/sec) of velocity
          const VELOCITY_BLUR_MAX = 18;  // hard ceiling
          const velocityBlur = Math.min(focusVelocity * VELOCITY_BLUR_GAIN * fps, VELOCITY_BLUR_MAX);
          const totalBlur = blur + velocityBlur;

          // Consistent soft white halo on the focused card — no per-app color.
          // Reads as "key light from camera" rather than a colored glow.
          const glowStrength = focusBump;  // 0..1 — same curve as magnify
          const GLOW_SIZE = CARD_SIZE * 1.7;
          const glowOpacity = glowStrength * 0.55;

          return (
            <React.Fragment key={app.name}>
              {/* Soft white halo behind the focused card — consistent across apps */}
              <div
                style={{
                  position: 'absolute',
                  top: `${VERTICAL_ANCHOR * 100}%`,
                  left: '50%',
                  width: GLOW_SIZE,
                  height: GLOW_SIZE,
                  marginLeft: -GLOW_SIZE / 2,
                  marginTop: -GLOW_SIZE / 2,
                  transform: `translate3d(0, ${y}px, ${z - 1}px) rotateX(${rotX}deg) scale(${magnify})`,
                  background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 60%)',
                  opacity: glowOpacity * opacity,
                  zIndex: 1000 - Math.round(abs * 10) - 1,
                  filter: `blur(${24 + velocityBlur * 0.3}px)`,
                  pointerEvents: 'none',
                  willChange: 'transform, opacity',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: `${VERTICAL_ANCHOR * 100}%`,
                  left: '50%',
                  width: CARD_SIZE,
                  height: CARD_SIZE,
                  marginLeft: -CARD_SIZE / 2,
                  marginTop: -CARD_SIZE / 2,
                  transform: `translate3d(0, ${y}px, ${z}px) rotateX(${rotX}deg) scale(${magnify})`,
                  filter: `blur(${totalBlur}px)`,
                  opacity,
                  zIndex: 1000 - Math.round(abs * 10),
                  transformStyle: 'preserve-3d',
                }}
              >
                <AppCard app={app} focused={abs < 0.15} />
              </div>
            </React.Fragment>
          );
        })}
      </div>

    </AbsoluteFill>
  );
};

const AppCard: React.FC<{ app: App; focused: boolean }> = ({ app, focused }) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      borderRadius: 76,
      background: app.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      // Layered shadow stack — tight contact + medium ambient + far diffuse.
      // Plus a 1px inner highlight to suggest a subtle bevel under key light.
      boxShadow: focused
        ? [
            '0 2px 4px rgba(0,0,0,0.35)',
            '0 12px 32px rgba(0,0,0,0.45)',
            '0 48px 96px rgba(0,0,0,0.55)',
            'inset 0 0 0 1px rgba(255,255,255,0.08)',
          ].join(', ')
        : [
            '0 1px 3px rgba(0,0,0,0.3)',
            '0 8px 20px rgba(0,0,0,0.4)',
            '0 24px 56px rgba(0,0,0,0.5)',
            'inset 0 0 0 1px rgba(255,255,255,0.05)',
          ].join(', '),
      overflow: 'hidden',
    }}
  >
    <Img
      src={staticFile(`icons/${app.icon}`)}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  </div>
);
