import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';

// ─── Roles to populate the org chart ──────────────────────────────────────
type Role = {
  title: string;
  monogram: string;
  hue: number; // 0..360 for the avatar circle gradient
};
const ROLES: Role[] = [
  { title: 'AI Marketing',  monogram: 'M', hue: 220 },
  { title: 'AI Sales',      monogram: 'S', hue: 145 },
  { title: 'AI Engineer',   monogram: 'E', hue: 280 },
  { title: 'AI Analyst',    monogram: 'A', hue: 30  },
  { title: 'AI Designer',   monogram: 'D', hue: 340 },
  { title: 'AI Ops',        monogram: 'O', hue: 190 },
];

// ─── Layout knobs ─────────────────────────────────────────────────────────
const CEO_TILE_WIDTH = 360;
const CEO_TILE_HEIGHT = 200;
const CEO_TOP_OFFSET = 480;          // px from top of frame to top of CEO tile

const REPORT_TILE_WIDTH = 280;
const REPORT_TILE_HEIGHT = 240;
const REPORTS_TOP_OFFSET = 1080;     // px from top of frame to top of report tiles
const REPORT_GAP = 24;               // px between adjacent report tiles
// Cards arrange in 2 rows of 3 to fit 1080-wide vertical comfortably
const REPORTS_PER_ROW = 3;
const ROW_GAP = 60;                  // vertical gap between the two rows

// ─── Animation timeline (frames) ──────────────────────────────────────────
const CEO_FADE_END = 18;             // CEO tile fully visible
const LINES_DRAW_START = 14;
const LINES_DRAW_END = 30;
const FIRST_REPORT_AT = 24;          // first AI tile starts appearing
const REPORT_STAGGER = 14;           // frames between successive tiles
const REPORT_DURATION = 18;          // frames each tile takes to settle

export const AIOrgChart: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, fps } = useVideoConfig();

  // Position helpers — center each row horizontally
  const totalRowWidth = REPORTS_PER_ROW * REPORT_TILE_WIDTH + (REPORTS_PER_ROW - 1) * REPORT_GAP;
  const rowStartX = (width - totalRowWidth) / 2;

  const reportPositions = ROLES.map((_, i) => {
    const row = Math.floor(i / REPORTS_PER_ROW);
    const col = i % REPORTS_PER_ROW;
    const x = rowStartX + col * (REPORT_TILE_WIDTH + REPORT_GAP);
    const y = REPORTS_TOP_OFFSET + row * (REPORT_TILE_HEIGHT + ROW_GAP);
    return { x, y, cx: x + REPORT_TILE_WIDTH / 2, cy: y };
  });

  const ceoX = (width - CEO_TILE_WIDTH) / 2;
  const ceoY = CEO_TOP_OFFSET;
  const ceoCenterX = ceoX + CEO_TILE_WIDTH / 2;
  const ceoBottomY = ceoY + CEO_TILE_HEIGHT;

  // CEO tile — fades in immediately
  const ceoOpacity = interpolate(frame, [0, CEO_FADE_END], [0, 1], { extrapolateRight: 'clamp' });
  const ceoLift = interpolate(frame, [0, CEO_FADE_END], [12, 0], { extrapolateRight: 'clamp' });

  // Line draw progress (0..1) — shared timing across all connector lines
  const lineProgress = interpolate(
    frame,
    [LINES_DRAW_START, LINES_DRAW_END],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill
      style={{
        background: '#00FF00',  // chroma-key green — keyed out in CapCut
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif',
      }}
    >
      {/* Connector lines (SVG layer, behind tiles) */}
      {/* Lines only route to the FIRST ROW of tiles. Second-row tiles sit
          directly under their first-row counterparts, so a thin vertical
          continuation line connects them visually. */}
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        {reportPositions.slice(0, REPORTS_PER_ROW).map((p, i) => {
          const midY = (ceoBottomY + p.cy) / 2;
          const path = [
            `M ${ceoCenterX} ${ceoBottomY}`,
            `L ${ceoCenterX} ${midY - 20}`,
            `Q ${ceoCenterX} ${midY}, ${ceoCenterX + (p.cx - ceoCenterX) * 0.05} ${midY}`,
            `L ${p.cx - (p.cx - ceoCenterX) * 0.05} ${midY}`,
            `Q ${p.cx} ${midY}, ${p.cx} ${midY + 20}`,
            `L ${p.cx} ${p.cy}`,
          ].join(' ');
          const approxLen = Math.abs(ceoBottomY - p.cy) + Math.abs(p.cx - ceoCenterX) + 80;
          const dashOffset = approxLen * (1 - lineProgress);
          return (
            <path
              key={i}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={approxLen}
              strokeDashoffset={dashOffset}
            />
          );
        })}
        {/* Vertical continuation: from bottom of each row-1 tile down to top of row-2 tile */}
        {reportPositions.slice(REPORTS_PER_ROW).map((p, i) => {
          const topRow = reportPositions[i];
          const startY = topRow.y + REPORT_TILE_HEIGHT;
          const endY = p.y;
          const len = endY - startY;
          const dashOffset = len * (1 - lineProgress);
          return (
            <line
              key={`c-${i}`}
              x1={p.cx}
              y1={startY}
              x2={p.cx}
              y2={endY}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={len}
              strokeDashoffset={dashOffset}
            />
          );
        })}
      </svg>

      {/* CEO / "You" tile */}
      <div
        style={{
          position: 'absolute',
          left: ceoX,
          top: ceoY,
          width: CEO_TILE_WIDTH,
          height: CEO_TILE_HEIGHT,
          opacity: ceoOpacity,
          transform: `translateY(${ceoLift}px)`,
        }}
      >
        <Tile accent="white" big>
          <TileLabel small>FOUNDER</TileLabel>
          <TileTitle big>You</TileTitle>
        </Tile>
      </div>

      {/* AI report tiles */}
      {ROLES.map((role, i) => {
        const startFrame = FIRST_REPORT_AT + i * REPORT_STAGGER;
        const localFrame = frame - startFrame;
        if (localFrame < 0) return null;

        // Spring pop-in: scale from 0.6 → 1.06 → 1.0 with ease-out
        const settle = spring({
          frame: localFrame,
          fps,
          config: { damping: 12, stiffness: 140, mass: 0.7 },
          durationInFrames: REPORT_DURATION,
        });
        const scale = interpolate(settle, [0, 1], [0.6, 1], { extrapolateRight: 'clamp' });
        const opacity = interpolate(localFrame, [0, REPORT_DURATION * 0.6], [0, 1], { extrapolateRight: 'clamp' });

        // Subtle "active" pulsing dot once tile is fully landed
        const landedFrames = Math.max(0, localFrame - REPORT_DURATION);
        const pulse = 0.6 + 0.4 * (Math.sin((landedFrames / fps) * Math.PI * 2) * 0.5 + 0.5);

        const p = reportPositions[i];
        return (
          <div
            key={role.title}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              width: REPORT_TILE_WIDTH,
              height: REPORT_TILE_HEIGHT,
              opacity,
              transform: `scale(${scale})`,
              transformOrigin: 'center top',
            }}
          >
            <Tile accent="navy">
              <Avatar hue={role.hue} monogram={role.monogram} />
              <TileLabel>EMPLOYEE</TileLabel>
              <TileTitle>{role.title}</TileTitle>
              <ActivePill opacity={pulse} />
            </Tile>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ── Sub-components ───────────────────────────────────────────────────────

const Tile: React.FC<{ accent: 'white' | 'navy'; big?: boolean; children: React.ReactNode }> = ({
  accent,
  big,
  children,
}) => {
  const isWhite = accent === 'white';
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 28,
        background: isWhite
          ? 'linear-gradient(180deg, #ffffff 0%, #f4f4f6 100%)'
          : 'linear-gradient(180deg, #1a2138 0%, #0f1525 100%)',
        boxShadow: [
          '0 1px 2px rgba(0,0,0,0.25)',
          '0 8px 24px rgba(0,0,0,0.35)',
          '0 24px 56px rgba(0,0,0,0.35)',
          isWhite
            ? 'inset 0 0 0 1px rgba(0,0,0,0.06)'
            : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
        ].join(', '),
        padding: big ? 28 : 20,
        display: 'flex',
        flexDirection: 'column',
        gap: big ? 6 : 8,
        color: isWhite ? '#0a0a0a' : '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
};

const TileLabel: React.FC<{ small?: boolean; children: React.ReactNode }> = ({ small, children }) => (
  <div
    style={{
      fontSize: small ? 18 : 16,
      fontWeight: 600,
      letterSpacing: '0.18em',
      opacity: 0.55,
      textTransform: 'uppercase',
    }}
  >
    {children}
  </div>
);

const TileTitle: React.FC<{ big?: boolean; children: React.ReactNode }> = ({ big, children }) => (
  <div
    style={{
      fontSize: big ? 64 : 32,
      fontWeight: 700,
      letterSpacing: '-0.02em',
      lineHeight: 1.05,
    }}
  >
    {children}
  </div>
);

const Avatar: React.FC<{ hue: number; monogram: string }> = ({ hue, monogram }) => (
  <div
    style={{
      width: 56,
      height: 56,
      borderRadius: '50%',
      background: `linear-gradient(135deg, hsl(${hue}, 75%, 62%) 0%, hsl(${(hue + 30) % 360}, 70%, 48%) 100%)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 26,
      fontWeight: 700,
      color: '#fff',
      boxShadow: '0 2px 8px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.18)',
      marginBottom: 4,
    }}
  >
    {monogram}
  </div>
);

const ActivePill: React.FC<{ opacity: number }> = ({ opacity }) => (
  <div
    style={{
      position: 'absolute',
      top: 16,
      right: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '0.06em',
      color: 'rgba(255,255,255,0.7)',
    }}
  >
    <div
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: '#34d058',
        opacity,
        boxShadow: `0 0 12px rgba(52,208,88,${opacity * 0.8})`,
      }}
    />
    <span>ACTIVE</span>
  </div>
);
