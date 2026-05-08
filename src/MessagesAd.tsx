import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  getRemotionEnvironment,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FONT_STACK =
  '"SF Pro Display", "SF Pro", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const IMESSAGE_BLUE = "#007AFF";
const FIELD_GRAY = "#F2F2F7";
const BG_WHITE = "#FFFFFF";
// Incoming-message gray (iMessage's standard light-mode received bubble).
const RECEIVED_GRAY = "#E9E9EB";
const RECEIVED_TEXT = "#000000";

const sec = (s: number, fps: number) => Math.round(s * fps);

/**
 * Per-character width lookup for SF Pro Display @ weight 500, expressed
 * in em (multiply by font-size in px to get pixel width). Tuned against
 * the actual font's glyph metrics so we can size bubbles snugly around
 * a phrase regardless of which letters it contains — a fixed average
 * (e.g. 0.44em/char) overshoots phrases with many narrow letters
 * (i, l, t, f, r) and undershoots phrases with wide letters (m, w).
 *
 * Unknown characters fall back to 0.55em — a conservative default for
 * an "average" lowercase letter.
 */
const SF_PRO_CHAR_WIDTHS: Record<string, number> = {
  // narrow lowercase
  i: 0.27,
  l: 0.27,
  t: 0.32,
  f: 0.32,
  r: 0.35,
  j: 0.27,
  // medium lowercase
  a: 0.5,
  c: 0.52,
  e: 0.5,
  s: 0.5,
  n: 0.55,
  o: 0.55,
  u: 0.55,
  v: 0.5,
  x: 0.5,
  y: 0.5,
  z: 0.5,
  b: 0.55,
  d: 0.55,
  g: 0.55,
  h: 0.55,
  k: 0.5,
  p: 0.55,
  q: 0.55,
  // wide lowercase
  m: 0.85,
  w: 0.78,
  // uppercase (approximate — most are noticeably wider than lowercase)
  A: 0.65,
  B: 0.65,
  C: 0.7,
  D: 0.7,
  E: 0.6,
  F: 0.55,
  G: 0.72,
  H: 0.7,
  I: 0.3,
  J: 0.5,
  K: 0.65,
  L: 0.55,
  M: 0.85,
  N: 0.7,
  O: 0.74,
  P: 0.62,
  Q: 0.74,
  R: 0.65,
  S: 0.6,
  T: 0.6,
  U: 0.7,
  V: 0.65,
  W: 0.92,
  X: 0.65,
  Y: 0.6,
  Z: 0.6,
  // digits, punctuation, symbols
  "0": 0.55,
  "1": 0.55,
  "2": 0.55,
  "3": 0.55,
  "4": 0.55,
  "5": 0.55,
  "6": 0.55,
  "7": 0.55,
  "8": 0.55,
  "9": 0.55,
  " ": 0.28,
  ".": 0.27,
  ",": 0.27,
  "'": 0.22,
  "\"": 0.35,
  "+": 0.55,
  "-": 0.32,
  "?": 0.5,
  "!": 0.27,
  ":": 0.27,
  ";": 0.27,
};

/**
 * Sum of per-character widths in em for a string. Used to size text
 * bubbles to fit their content snugly. With 0 letter-spacing, multiply
 * by font-size (px) to get rendered text width in px.
 */
const measureTextEm = (text: string): number => {
  let sum = 0;
  for (const ch of text) {
    sum += SF_PRO_CHAR_WIDTHS[ch] ?? 0.55;
  }
  return sum;
};

type CaptionProps = {
  text: string;
  emphasized?: string;
  scale: number;
  width: number;
  height: number;
  /** Seconds before sequence end where caption begins fading out. */
  fadeOutAtSec?: number;
  durationSec?: number;
};

const Caption: React.FC<CaptionProps> = ({
  text,
  emphasized,
  scale,
  width,
  height,
  fadeOutAtSec,
  durationSec,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const popFrames = sec(0.25, fps);
  const popProgress = interpolate(frame, [0, popFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const popScale = 0.92 + 0.08 * popProgress;
  let popOpacity = popProgress;

  if (fadeOutAtSec != null && durationSec != null) {
    const startFrame = sec(fadeOutAtSec, fps);
    const endFrame = sec(durationSec, fps);
    const outP = interpolate(frame, [startFrame, endFrame], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    });
    popOpacity = Math.min(popOpacity, outP);
  }

  const renderText = () => {
    if (!emphasized) return text;
    const idx = text.indexOf(emphasized);
    if (idx === -1) return text;
    const before = text.slice(0, idx);
    const after = text.slice(idx + emphasized.length);
    const empPop = interpolate(
      frame,
      [sec(0.05, fps), sec(0.35, fps)],
      [1, 1.15],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.back(2)),
      },
    );
    const empSettle = interpolate(
      frame,
      [sec(0.35, fps), sec(0.55, fps)],
      [1.15, 1.0],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.cubic),
      },
    );
    const empScale = frame < sec(0.35, fps) ? empPop : empSettle;
    return (
      <>
        {before}
        <span
          style={{
            display: "inline-block",
            fontWeight: 900,
            transform: `scale(${empScale})`,
            transformOrigin: "center",
          }}
        >
          {emphasized}
        </span>
        {after}
      </>
    );
  };

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: height * 0.73,
        display: "flex",
        justifyContent: "center",
        opacity: popOpacity,
        transform: `scale(${popScale})`,
      }}
    >
      <div
        style={{
          background: "rgba(0,0,0,0.75)",
          color: "#FFFFFF",
          fontFamily: FONT_STACK,
          fontSize: 64 * scale,
          fontWeight: 700,
          padding: `${18 * scale}px ${32 * scale}px`,
          borderRadius: 100 * scale,
          letterSpacing: -0.5 * scale,
          maxWidth: width * 0.86,
          textAlign: "center",
          lineHeight: 1.15,
        }}
      >
        {renderText()}
      </div>
    </div>
  );
};

type SceneProps = {
  scale: number;
  width: number;
  height: number;
  /** Seconds (local to the sequence) over which to fade in at the start. */
  fadeInSec?: number;
  /** Seconds before the sequence end where the fade-out begins. */
  fadeOutAtSec?: number;
  /** Total length of this sequence in seconds; needed to compute fade-out window. */
  durationSec?: number;
};

/**
 * Smooth opacity+scale envelope for crossfading between scenes. Returns
 * { opacity, scale } based on the local frame position within a sequence.
 */
const useSceneEnvelope = ({
  fadeInSec,
  fadeOutAtSec,
  durationSec,
}: {
  fadeInSec?: number;
  fadeOutAtSec?: number;
  durationSec?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let opacity = 1;
  let scaleEnv = 1;

  if (fadeInSec && fadeInSec > 0) {
    const fadeFrames = sec(fadeInSec, fps);
    const p = interpolate(frame, [0, fadeFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
    opacity = Math.min(opacity, p);
    scaleEnv = Math.min(scaleEnv, interpolate(p, [0, 1], [0.985, 1]));
  }

  if (fadeOutAtSec != null && durationSec != null) {
    const startFrame = sec(fadeOutAtSec, fps);
    const endFrame = sec(durationSec, fps);
    const p = interpolate(frame, [startFrame, endFrame], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    });
    opacity = Math.min(opacity, p);
    // p ramps 1 → 0 over the fade-out window; map it to a slight scale-up.
    scaleEnv = Math.min(scaleEnv, interpolate(p, [0, 1], [1.015, 1]));
  }

  return { opacity, scaleEnv };
};

/**
 * Build the SVG `d` string for an iMessage-style bubble whose
 * bottom-right or bottom-LEFT corner morphs into a hooked tail.
 *
 * The bubble outline is walked clockwise from the top-left. The "tail
 * corner" replaces what would otherwise be a quarter-circle rounded
 * corner with two cubic Béziers that blend smoothly between an arc
 * (when ext = 0) and an iMessage tail (when ext = full extrusion).
 *
 * Params:
 *   width:      bubble width
 *   height:     bubble height
 *   cr:         corner radius
 *   ext:        visible tail extrusion past the bubble's tail-side edge
 *   hookH:      "hook depth" — how far the tail dips below baseline
 *   tailScaleX: 0..1, drives the arc→hook control-point blend (also
 *               typically what `ext` is derived from)
 *   tailSide:   "right" or "left" — which bottom corner becomes the tail
 *   originX/Y:  top-left of the bubble in SVG coordinates
 */
type TailSide = "right" | "left";
const buildBubblePath = ({
  width,
  height,
  cr,
  ext,
  hookH,
  tailScaleX,
  tailSide,
  originX,
  originY,
}: {
  width: number;
  height: number;
  cr: number;
  ext: number;
  hookH: number;
  tailScaleX: number;
  tailSide: TailSide;
  originX: number;
  originY: number;
}): string => {
  const K = 0.5523; // standard cubic-bezier circle-approximation factor
  const cornerMidInset = cr * (1 - Math.SQRT1_2);
  const blend = tailScaleX;

  const bx = originX;
  const by = originY;
  const bRight = bx + width;
  const bBottom = by + height;

  if (tailSide === "right") {
    // Tail at bottom-right — see Scene 3 sent bubble for original layout.
    const aX = bRight;
    const aY = bBottom - cr;
    const bX2 = bRight - cr;
    const bY2 = bBottom;

    const cornerMidX = bRight - cornerMidInset;
    const cornerMidY = bBottom - cornerMidInset;
    const tailTipX = bRight + ext;
    const tailTipY = bBottom + hookH * 0.08;
    const tX = cornerMidX * (1 - blend) + tailTipX * blend;
    const tY = cornerMidY * (1 - blend) + tailTipY * blend;

    const arcA1x = aX;
    const arcA1y = aY + cr * K * 0.55;
    const arcA2x = cornerMidX + cr * K * 0.4;
    const arcA2y = cornerMidY - cr * K * 0.4;
    const tailA1x = aX + ext * 0.05;
    const tailA1y = aY + cr * 0.55;
    const tailA2x = tailTipX - ext * 0.3;
    const tailA2y = tailTipY - hookH * 0.45;
    const a1x = arcA1x * (1 - blend) + tailA1x * blend;
    const a1y = arcA1y * (1 - blend) + tailA1y * blend;
    const a2x = arcA2x * (1 - blend) + tailA2x * blend;
    const a2y = arcA2y * (1 - blend) + tailA2y * blend;

    const arcB1x = cornerMidX - cr * K * 0.4;
    const arcB1y = cornerMidY + cr * K * 0.4;
    const arcB2x = bX2 + cr * K * 0.55;
    const arcB2y = bY2;
    const tailB1x = tailTipX - ext * 0.5;
    const tailB1y = tailTipY - hookH * 0.55;
    const tailB2x = bX2 + cr * 0.6;
    const tailB2y = bY2;
    const b1x = arcB1x * (1 - blend) + tailB1x * blend;
    const b1y = arcB1y * (1 - blend) + tailB1y * blend;
    const b2x = arcB2x * (1 - blend) + tailB2x * blend;
    const b2y = arcB2y * (1 - blend) + tailB2y * blend;

    return [
      `M ${bx + cr} ${by}`,
      `L ${bRight - cr} ${by}`,
      `A ${cr} ${cr} 0 0 1 ${bRight} ${by + cr}`,
      `L ${aX} ${aY}`,
      `C ${a1x} ${a1y} ${a2x} ${a2y} ${tX} ${tY}`,
      `C ${b1x} ${b1y} ${b2x} ${b2y} ${bX2} ${bY2}`,
      `L ${bx + cr} ${bBottom}`,
      `A ${cr} ${cr} 0 0 1 ${bx} ${bBottom - cr}`,
      `L ${bx} ${by + cr}`,
      `A ${cr} ${cr} 0 0 1 ${bx + cr} ${by}`,
      `Z`,
    ].join(" ");
  }

  // tailSide === "left": mirror the bottom-right tail to bottom-left.
  // Walk clockwise from top-left as before, but swap the bottom-left
  // corner with the tail and keep the bottom-right as a normal arc.
  const aX = bx;
  const aY = bBottom - cr;
  const bX2 = bx + cr;
  const bY2 = bBottom;

  const cornerMidX = bx + cornerMidInset;
  const cornerMidY = bBottom - cornerMidInset;
  const tailTipX = bx - ext;
  const tailTipY = bBottom + hookH * 0.08;
  const tX = cornerMidX * (1 - blend) + tailTipX * blend;
  const tY = cornerMidY * (1 - blend) + tailTipY * blend;

  // Mirror the right-side control logic across the vertical axis at
  // the bubble's left edge: x-offsets flip sign.
  const arcA1x = aX;
  const arcA1y = aY + cr * K * 0.55;
  const arcA2x = cornerMidX - cr * K * 0.4;
  const arcA2y = cornerMidY - cr * K * 0.4;
  const tailA1x = aX - ext * 0.05;
  const tailA1y = aY + cr * 0.55;
  const tailA2x = tailTipX + ext * 0.3;
  const tailA2y = tailTipY - hookH * 0.45;
  const a1x = arcA1x * (1 - blend) + tailA1x * blend;
  const a1y = arcA1y * (1 - blend) + tailA1y * blend;
  const a2x = arcA2x * (1 - blend) + tailA2x * blend;
  const a2y = arcA2y * (1 - blend) + tailA2y * blend;

  const arcB1x = cornerMidX + cr * K * 0.4;
  const arcB1y = cornerMidY + cr * K * 0.4;
  const arcB2x = bX2 - cr * K * 0.55;
  const arcB2y = bY2;
  const tailB1x = tailTipX + ext * 0.5;
  const tailB1y = tailTipY - hookH * 0.55;
  const tailB2x = bX2 - cr * 0.6;
  const tailB2y = bY2;
  const b1x = arcB1x * (1 - blend) + tailB1x * blend;
  const b1y = arcB1y * (1 - blend) + tailB1y * blend;
  const b2x = arcB2x * (1 - blend) + tailB2x * blend;
  const b2y = arcB2y * (1 - blend) + tailB2y * blend;

  return [
    `M ${bx + cr} ${by}`,
    `L ${bRight - cr} ${by}`,
    `A ${cr} ${cr} 0 0 1 ${bRight} ${by + cr}`,
    `L ${bRight} ${bBottom - cr}`,
    `A ${cr} ${cr} 0 0 1 ${bRight - cr} ${bBottom}`,
    `L ${bX2} ${bY2}`,
    // Reverse direction for the left-side tail: we go from B → T → A
    // (bottom of the corner up to the top of the corner).
    `C ${b1x} ${b1y} ${b2x} ${b2y} ${tX} ${tY}`,
    `C ${a2x} ${a2y} ${a1x} ${a1y} ${aX} ${aY}`,
    `L ${bx} ${by + cr}`,
    `A ${cr} ${cr} 0 0 1 ${bx + cr} ${by}`,
    `Z`,
  ].join(" ");
};

/**
 * Reusable bubble component. Renders the bubble + tail as a single SVG
 * path with a drop-shadow filter, plus a text overlay aligned to the
 * bubble's interior. Both the sent (right-tail) and received (left-tail)
 * bubbles in this composition use this.
 */
type MessageBubbleProps = {
  width: number;
  height: number;
  cornerRadius: number;
  /** Visible tail length past the bubble's tail-side edge, in pixels. */
  tailExt: number;
  /** Tail dip below baseline, in pixels. */
  tailHook: number;
  /** Arc→tail blend factor, 0..1. Usually equals tailExt/tailExtFull. */
  tailScaleX: number;
  tailSide: TailSide;
  bubbleColor: string;
  textColor: string;
  fontSize: number;
  paddingX: number;
  letterSpacing: number;
  text: string;
  /**
   * How to align text horizontally inside the bubble.
   *  - "center" (default): text is centered, so any slack between
   *    the bubble's interior and the actual rendered text width is
   *    split evenly left and right. Use this for SETTLED bubbles
   *    whose width is sized to fit the text snugly.
   *  - "start": text is left-aligned. Use this during typewriter
   *    animations where the text grows character-by-character — left
   *    alignment makes each new character appear at the right edge
   *    of the typed string, which is what users expect a text field
   *    to look like.
   */
  textAlign?: "center" | "start";
  /** Optional cursor span (typing). */
  cursor?: { visible: boolean; color: string; widthPx: number };
  /** Drop-shadow opacity, 0..1. 0 disables shadow. */
  shadowOpacity?: number;
  shadowBlur?: number;
  shadowOffsetY?: number;
  /** Stable id for the SVG filter (must be unique per bubble). */
  filterId: string;
};
const MessageBubble: React.FC<MessageBubbleProps> = ({
  width,
  height,
  cornerRadius,
  tailExt,
  tailHook,
  tailScaleX,
  tailSide,
  bubbleColor,
  textColor,
  fontSize,
  paddingX,
  letterSpacing,
  text,
  textAlign = "center",
  cursor,
  shadowOpacity = 0.18,
  shadowBlur = 20,
  shadowOffsetY = 4,
  filterId,
}) => {
  // The SVG box must include the visible tail and the shadow blur.
  const svgPadding = shadowBlur * 1.5;
  const extPadLeft = tailSide === "left" ? tailExt + svgPadding : svgPadding;
  const extPadRight = tailSide === "right" ? tailExt + svgPadding : svgPadding;
  const svgW = width + extPadLeft + extPadRight;
  const svgH = height + svgPadding * 2 + shadowOffsetY;

  const d = buildBubblePath({
    width,
    height,
    cr: cornerRadius,
    ext: tailExt,
    hookH: tailHook,
    tailScaleX,
    tailSide,
    originX: extPadLeft,
    originY: svgPadding,
  });

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
      }}
    >
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{
          position: "absolute",
          left: -extPadLeft,
          top: -svgPadding,
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        <defs>
          <filter
            id={filterId}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feDropShadow
              dx="0"
              dy={shadowOffsetY}
              stdDeviation={shadowBlur / 2}
              floodColor="#000"
              floodOpacity={shadowOpacity}
            />
          </filter>
        </defs>
        <path
          d={d}
          fill={bubbleColor}
          filter={shadowOpacity > 0 ? `url(#${filterId})` : undefined}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width,
          height,
          display: "flex",
          alignItems: "center",
          // For settled bubbles, center the text so any slack
          // between the bubble's interior width and the rendered
          // text width is split evenly left/right rather than piling
          // on the right side. For typewriter-style typing, use
          // flex-start so each new character appears at the natural
          // cursor position.
          justifyContent: textAlign === "center" ? "center" : "flex-start",
          paddingLeft: paddingX,
          paddingRight: paddingX,
          fontFamily: FONT_STACK,
          fontSize,
          color: textColor,
          fontWeight: 500,
          letterSpacing,
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}
      >
        <span>{text}</span>
        {cursor && (
          <span
            style={{
              display: "inline-block",
              width: cursor.widthPx,
              height: fontSize * 1.05,
              marginLeft: 4,
              background: cursor.color,
              opacity: cursor.visible ? 1 : 0,
              transform: "translateY(2px)",
            }}
          />
        )}
      </div>
    </div>
  );
};

/**
 * Instagram profile-page background. Renders a simplified IG profile
 * (header section + 3-column post grid), holds for a beat, then
 * scrolls the page down so more grid posts come into view.
 *
 * The chrome is intentionally minimal (just profile header + grid)
 * so the background reads as "they're looking through her profile"
 * without competing with the bubbles in the foreground.
 *
 * Placeholder colors fill each grid cell; real images can be dropped
 * in later by replacing each cell's `background` with a `<Img>` /
 * staticFile().
 */
type InstagramProfileProps = {
  /** Frame index relative to when the background appears. The first
   * `holdFrames` of this drive a static profile view; after that the
   * page scrolls down at a steady pace. */
  driveFrame: number;
  fps: number;
  /** Layout dimensions of the canvas region this fills. */
  width: number;
  height: number;
  scale: number;
  /** Master opacity for the whole background (0..1). */
  opacity: number;
  /** Optional index of a grid cell that should receive a tap-pulse
   * (small scale-down then back). Used during the dwell phase to
   * simulate the user tapping a post. */
  tappedCellIndex?: number;
  /** Tap-pulse scale to apply to `tappedCellIndex` (1 = no scale,
   * 0.94 = scaled down ~6%). Defaults to 1. */
  tappedCellScale?: number;
  /** Optional opacity multiplier for `tappedCellIndex` (so the cell
   * can be hidden once a flight clone takes over outside this
   * component). 1 = visible, 0 = hidden. Defaults to 1. */
  tappedCellOpacity?: number;
};

// Placeholder colors for each grid cell. The user will swap these for
// real images once the layout is locked.
const PROFILE_GRID_COLORS = [
  "#F5C9C0", "#E8D5B7", "#B8C9A7",
  "#D4B5DB", "#F2D9A8", "#C0CBD9",
  "#EDB89A", "#A9C4C9", "#DCC1B0",
  "#C9D6BB", "#E5B5C8", "#B0C2D4",
  "#F0CFA8", "#C8B8D6", "#D9C4A8",
  "#A8C0BE", "#E8C0A8", "#C4D4C0",
  "#D8B8B0", "#B0C4C0", "#E0CFB8",
  "#C8D0B8", "#D4B5C0", "#B8D0C4",
];

/**
 * Shared layout geometry for the Instagram profile background. Same
 * values used inside `InstagramProfile` for rendering AND inside
 * Scene 3 for computing the dwelled-cell screen position (so the
 * flight animation lifts off from the cell's actual on-screen spot).
 */
const computeProfileLayout = (width: number, scale: number) => {
  const headerPadX = 24 * scale;
  const navHeight = 88 * scale;
  const avatarSize = 180 * scale;
  const profileSectionH = 280 * scale;
  const bioH = 110 * scale;
  const buttonsH = 90 * scale;
  const tabBarH = 70 * scale;
  const headerTotalH =
    navHeight + profileSectionH + bioH + buttonsH + tabBarH;
  const gridGap = 4 * scale;
  const cellSize = (width - gridGap * 2) / 3;
  const gridRows = 8;
  const gridCols = 3;
  const gridHeight = cellSize * gridRows + gridGap * (gridRows - 1);
  const totalContentH = headerTotalH + gridHeight;
  return {
    headerPadX,
    navHeight,
    avatarSize,
    profileSectionH,
    bioH,
    buttonsH,
    tabBarH,
    headerTotalH,
    gridGap,
    cellSize,
    gridRows,
    gridCols,
    gridHeight,
    totalContentH,
  };
};

/** Layout-Y center of grid cell at index `idx` (row-major, 3 cols). */
const cellLayoutY = (
  idx: number,
  layout: ReturnType<typeof computeProfileLayout>,
): number => {
  const row = Math.floor(idx / layout.gridCols);
  return (
    layout.headerTotalH +
    row * (layout.cellSize + layout.gridGap) +
    layout.cellSize / 2
  );
};

/** Layout-X center of grid cell at index `idx` (row-major, 3 cols). */
const cellLayoutX = (
  idx: number,
  layout: ReturnType<typeof computeProfileLayout>,
): number => {
  const col = idx % layout.gridCols;
  return col * (layout.cellSize + layout.gridGap) + layout.cellSize / 2;
};

const InstagramProfile: React.FC<InstagramProfileProps> = ({
  driveFrame,
  fps,
  width,
  height,
  scale,
  opacity,
  tappedCellIndex,
  tappedCellScale = 1,
  tappedCellOpacity = 1,
}) => {
  // Geometry derived from the shared helper so the parent can compute
  // matching screen positions for the dwell-cell flight animation.
  const layout = computeProfileLayout(width, scale);
  const {
    headerPadX,
    navHeight,
    avatarSize,
    profileSectionH,
    bioH,
    buttonsH,
    tabBarH,
    headerTotalH,
    gridGap,
    cellSize,
    gridRows,
    totalContentH,
  } = layout;

  // ── Scroll behavior ───────────────────────────────────────────
  // Real users don't scroll at a constant velocity AND they don't
  // scroll at a uniform pace through every part of a page — they
  // dwell on interesting things (profile bio, a cute photo) and
  // flick past filler. We model that with content-aware variable
  // speed: each stage maps to a *region* of the page (header vs.
  // early grid vs. dwell row vs. cruise) and uses its own easing.
  //
  // Stages (driveFrame in seconds):
  //   0.00–0.80s  HOLD: profile fully visible, no scroll yet.
  //                (Initial landing — viewer registers the profile.)
  //   0.80–1.80s  SCAN HEADER: slow scroll through the profile
  //                section (avatar, stats, bio, action buttons).
  //                Reads as "user reading the bio." Cubic ease-out.
  //                Covers ~headerTotalH worth of scroll.
  //   1.80–2.40s  FLICK GRID: faster scroll through the first few
  //                grid rows. Linear-ish (slight ease-in-out).
  //   2.40–3.00s  DWELL: scroll holds on a "good post" row for
  //                ~0.6s — viewer pauses to look at a particular
  //                photo. (Picks the row centered ~60% through the
  //                content — a notional eye-catcher.)
  //   3.00s+     CRUISE: slow continuous scroll covering the
  //                remaining distance, gently easing as it
  //                approaches maxScroll. Cubic ease-in-out.
  //
  // Throughout the post-hold phase a small sinusoidal wobble (~4px,
  // 2.5Hz) is layered on the Y so the motion doesn't feel
  // mathematically smooth — simulates the finger's micro-jitter.
  const driveSec = driveFrame / fps;
  const maxScroll = Math.max(0, totalContentH - height);
  // Region targets — use page geometry to decide where each stage
  // lands. Clamped to maxScroll so short pages still scroll
  // sensibly even if these regions exceed the available distance.
  const headerScrollTarget = Math.min(maxScroll, headerTotalH * 0.85);
  const flickGridTarget = Math.min(
    maxScroll,
    headerScrollTarget + (cellSize + gridGap) * 2.5,
  );
  // Dwell point: ~60% through the total scroll (a posts row near
  // the middle of the grid).
  const dwellTarget = Math.min(maxScroll, maxScroll * 0.6);
  // Stage timings.
  const t = {
    holdEnd: 0.8,
    scanEnd: 1.8,
    flickEnd: 2.4,
    dwellEnd: 3.0,
    cruiseEnd: 5.5,
  };
  let baseScroll: number;
  if (driveSec < t.holdEnd) {
    // Hold — no scroll yet.
    baseScroll = 0;
  } else if (driveSec < t.scanEnd) {
    // Scan header — slow, deliberate.
    baseScroll = interpolate(
      driveSec,
      [t.holdEnd, t.scanEnd],
      [0, headerScrollTarget],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      },
    );
  } else if (driveSec < t.flickEnd) {
    // Flick through early grid — faster, near-linear.
    baseScroll = interpolate(
      driveSec,
      [t.scanEnd, t.flickEnd],
      [headerScrollTarget, flickGridTarget],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.cubic),
      },
    );
  } else if (driveSec < t.dwellEnd) {
    // Dwell — ease into the dwell target and hold there. Use a
    // cubic ease-out so the viewer feels the user "settling" on
    // the post rather than abruptly stopping.
    baseScroll = interpolate(
      driveSec,
      [t.flickEnd, t.dwellEnd],
      [flickGridTarget, dwellTarget],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      },
    );
  } else {
    // Cruise — slow continuous scroll covering the remainder. After
    // cruiseEnd we clamp at maxScroll.
    baseScroll = interpolate(
      driveSec,
      [t.dwellEnd, t.cruiseEnd],
      [dwellTarget, maxScroll],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.cubic),
      },
    );
  }

  // Micro-wobble: small sinusoidal jitter on Y, fading in only after
  // the hold so the initial profile-landing reads as still.
  const wobbleAmp = 4 * scale;
  const wobbleHz = 2.5; // cycles per second
  const wobbleEnabled = driveSec > t.holdEnd ? 1 : 0;
  const wobble =
    wobbleEnabled *
    wobbleAmp *
    Math.sin(2 * Math.PI * wobbleHz * (driveSec - t.holdEnd));

  const scrollPx = Math.min(maxScroll, Math.max(0, baseScroll + wobble));
  const pageY = -scrollPx;

  // Stat block (followers / following / posts).
  const renderStat = (label: string, value: string) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4 * scale,
        flex: 1,
      }}
    >
      <div
        style={{
          fontFamily: FONT_STACK,
          fontSize: 28 * scale,
          fontWeight: 700,
          color: "#000",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: FONT_STACK,
          fontSize: 20 * scale,
          color: "#262626",
        }}
      >
        {label}
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width,
        height,
        overflow: "hidden",
        opacity,
        // Subtle dim + small blur so the bubbles stay the focal
        // point. Tune `brightness` if real images come in too dark.
        filter: `blur(${3 * scale}px) brightness(0.94) saturate(0.92)`,
        pointerEvents: "none",
        background: "#FFFFFF", // IG light-mode background
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width,
          transform: `translateY(${pageY}px)`,
        }}
      >
        {/* ── Nav header (back arrow + username + ...) ─────────── */}
        <div
          style={{
            height: navHeight,
            paddingLeft: headerPadX,
            paddingRight: headerPadX,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `${1 * scale}px solid #DBDBDB`,
          }}
        >
          {/* back chevron */}
          <div
            style={{
              fontFamily: FONT_STACK,
              fontSize: 36 * scale,
              color: "#000",
              fontWeight: 300,
            }}
          >
            ‹
          </div>
          <div
            style={{
              fontFamily: FONT_STACK,
              fontSize: 26 * scale,
              fontWeight: 600,
              color: "#000",
            }}
          >
            _placeholder
          </div>
          {/* hamburger / dots */}
          <div
            style={{
              fontFamily: FONT_STACK,
              fontSize: 26 * scale,
              color: "#000",
              fontWeight: 600,
            }}
          >
            ⋯
          </div>
        </div>

        {/* ── Profile section (avatar + stats) ─────────────────── */}
        <div
          style={{
            height: profileSectionH,
            paddingLeft: headerPadX,
            paddingRight: headerPadX,
            display: "flex",
            alignItems: "center",
            gap: 24 * scale,
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: "50%",
              background: PROFILE_GRID_COLORS[0],
              border: `${2 * scale}px solid #fff`,
              boxShadow: `0 0 0 ${2 * scale}px #DBDBDB`,
              flexShrink: 0,
            }}
          />
          {/* Stats row */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-around",
            }}
          >
            {renderStat("posts", "284")}
            {renderStat("followers", "1.2k")}
            {renderStat("following", "537")}
          </div>
        </div>

        {/* ── Bio (display name + caption) ─────────────────────── */}
        <div
          style={{
            height: bioH,
            paddingLeft: headerPadX,
            paddingRight: headerPadX,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 6 * scale,
          }}
        >
          <div
            style={{
              fontFamily: FONT_STACK,
              fontSize: 24 * scale,
              fontWeight: 700,
              color: "#000",
            }}
          >
            placeholder name
          </div>
          <div
            style={{
              fontFamily: FONT_STACK,
              fontSize: 22 * scale,
              color: "#262626",
            }}
          >
            living life ✨ · sf → la
          </div>
        </div>

        {/* ── Action buttons (Follow / Message / +) ───────────── */}
        <div
          style={{
            height: buttonsH,
            paddingLeft: headerPadX,
            paddingRight: headerPadX,
            display: "flex",
            alignItems: "center",
            gap: 8 * scale,
          }}
        >
          <div
            style={{
              flex: 1,
              height: 60 * scale,
              borderRadius: 8 * scale,
              background: "#0095F6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_STACK,
              fontSize: 22 * scale,
              fontWeight: 600,
              color: "#fff",
            }}
          >
            Follow
          </div>
          <div
            style={{
              flex: 1,
              height: 60 * scale,
              borderRadius: 8 * scale,
              background: "#EFEFEF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_STACK,
              fontSize: 22 * scale,
              fontWeight: 600,
              color: "#000",
            }}
          >
            Message
          </div>
          <div
            style={{
              width: 60 * scale,
              height: 60 * scale,
              borderRadius: 8 * scale,
              background: "#EFEFEF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_STACK,
              fontSize: 24 * scale,
              fontWeight: 600,
              color: "#000",
            }}
          >
            +
          </div>
        </div>

        {/* ── Tab bar (grid icon highlighted) ───────────────────── */}
        <div
          style={{
            height: tabBarH,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            borderTop: `${1 * scale}px solid #DBDBDB`,
            borderBottom: `${1 * scale}px solid #DBDBDB`,
          }}
        >
          {/* grid icon (active) */}
          <div
            style={{
              width: 28 * scale,
              height: 28 * scale,
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gridTemplateRows: "1fr 1fr 1fr",
              gap: 2 * scale,
            }}
          >
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} style={{ background: "#000" }} />
            ))}
          </div>
          {/* reels / tagged placeholders */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 28 * scale,
                height: 28 * scale,
                borderRadius: 4 * scale,
                background: "rgba(0,0,0,0.45)",
              }}
            />
          ))}
        </div>

        {/* ── Post grid (3 columns) ────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(3, ${cellSize}px)`,
            gap: gridGap,
          }}
        >
          {Array.from({ length: gridRows * 3 }).map((_, idx) => {
            const isTapped = idx === tappedCellIndex;
            return (
              <div
                key={idx}
                style={{
                  width: cellSize,
                  height: cellSize,
                  background:
                    PROFILE_GRID_COLORS[idx % PROFILE_GRID_COLORS.length],
                  // Tap-pulse: only applied to the tapped cell. Others
                  // render unchanged.
                  transform: isTapped
                    ? `scale(${tappedCellScale})`
                    : undefined,
                  opacity: isTapped ? tappedCellOpacity : 1,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Scene 1 — 0s–2s: "In your messages"
// Folk logo spins, then continuously morphs (size + color + glyph) into the
// iMessage send button. Single shared circular container so the transition
// feels like one object, not a crossfade. Then it slides right while an
// empty input fades in beside it.
const Scene1: React.FC<SceneProps> = ({
  scale,
  width,
  height,
  fadeInSec,
  fadeOutAtSec,
  durationSec,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { opacity: envOpacity, scaleEnv } = useSceneEnvelope({
    fadeInSec,
    fadeOutAtSec,
    durationSec,
  });

  // All scene-1 motion completes before the crossfade window starts at
  // (2 - xfade) = 1.65s, so when Scene 1 fades out and Scene 2 fades in,
  // the chat-row pixels are already locked in place and identical.
  const spinStart = sec(0, fps);
  const spinEnd = sec(0.7, fps);
  const morphStart = sec(0.55, fps);
  const morphEnd = sec(1.05, fps);
  const slideStart = sec(1.05, fps);
  const slideEnd = sec(1.55, fps);

  // Spin decelerates and is fully settled by morphEnd so the morphed button
  // has a stable orientation.
  const angleDeg = interpolate(frame, [spinStart, spinEnd], [0, 360], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const logoBase = 280 * scale;
  // Match Scene 2's chat-row geometry exactly so the handoff is invisible.
  const buttonDiameter = 72 * scale;
  const inputHeight = 88 * scale;
  const inputWidth = width * 0.6864;
  const rowGap = 16 * scale;

  // One continuous progress drives every morph attribute together.
  const morphP = interpolate(frame, [morphStart, morphEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  const containerSize = interpolate(morphP, [0, 1], [logoBase, buttonDiameter]);
  // Background color: white → iMessage blue, channel-wise.
  const bgR = Math.round(interpolate(morphP, [0, 1], [255, 0x00]));
  const bgG = Math.round(interpolate(morphP, [0, 1], [255, 0x7a]));
  const bgB = Math.round(interpolate(morphP, [0, 1], [255, 0xff]));
  const containerBg = `rgb(${bgR}, ${bgG}, ${bgB})`;
  // Logo PNG and arrow swap inside the same shrinking circle, with a small
  // overlap so neither is fully gone mid-morph (keeps the disk feeling solid).
  const logoOpacity = interpolate(morphP, [0, 0.55], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const arrowOpacity = interpolate(morphP, [0.45, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Subtle shadow ramp-up so the button "lifts" as it forms.
  const shadowAlpha = interpolate(morphP, [0, 1], [0, 0.35]);

  // Final button center position matches Scene 2's row layout: row is
  // centered on width/2, button sits to the right of the input + gap.
  const rowWidth = inputWidth + rowGap + buttonDiameter;
  const finalButtonOffsetX = rowWidth / 2 - buttonDiameter / 2;

  const slideProgress = interpolate(
    frame,
    [slideStart, slideEnd],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  const buttonOffsetX = interpolate(
    slideProgress,
    [0, 1],
    [0, finalButtonOffsetX],
  );

  const inputSpring = spring({
    frame: frame - slideStart,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.6 },
  });
  const inputScale = interpolate(inputSpring, [0, 1], [0.95, 1]);
  const inputOpacity = interpolate(
    frame,
    [slideStart, slideStart + sec(0.25, fps)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const centerX = width / 2;
  const centerY = height / 2;
  // Input center: aligned to the same row layout, on the left of the button.
  const inputCenterX = centerX - rowWidth / 2 + inputWidth / 2;

  const arrowGlyphSize = buttonDiameter * 0.55;

  return (
    <AbsoluteFill style={{ opacity: envOpacity }}>
      {/* input field — rendered first so the button paints on top */}
      {frame >= slideStart && (
        <div
          style={{
            position: "absolute",
            left: inputCenterX,
            top: centerY,
            transform: `translate(-50%, -50%) scale(${inputScale * scaleEnv})`,
            transformOrigin: "right center",
            width: inputWidth,
            height: inputHeight,
            borderRadius: inputHeight / 2,
            background: FIELD_GRAY,
            opacity: inputOpacity,
            zIndex: 1,
          }}
        />
      )}

      {/* shared morph container — sits on top of the input via zIndex */}
      <div
        style={{
          position: "absolute",
          left: centerX + buttonOffsetX,
          top: centerY,
          width: containerSize,
          height: containerSize,
          borderRadius: "50%",
          background: containerBg,
          transform: `translate(-50%, -50%) rotate(${angleDeg}deg) scale(${scaleEnv})`,
          overflow: "hidden",
          boxShadow: `0 ${4 * scale}px ${16 * scale}px rgba(0,122,255,${shadowAlpha})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
        }}
      >
        {/* folk logo, fills the circular container edge-to-edge */}
        <Img
          src={staticFile("folk-logo.png")}
          style={{
            position: "absolute",
            width: containerSize,
            height: containerSize,
            objectFit: "cover",
            borderRadius: "50%",
            opacity: logoOpacity,
            display: "block",
          }}
        />
        {/* send arrow, scales with the container so it sits correctly inside */}
        <svg
          width={arrowGlyphSize * (containerSize / buttonDiameter)}
          height={arrowGlyphSize * (containerSize / buttonDiameter)}
          viewBox="0 0 24 24"
          fill="none"
          style={{ position: "absolute", opacity: arrowOpacity }}
        >
          <path
            d="M12 19V5M12 5L5 12M12 5L19 12"
            stroke="#FFFFFF"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

type TypingFieldProps = {
  scale: number;
  width: number;
  height: number;
  /** seconds since this scene started */
  localFrame: number;
  fps: number;
  /** typed text (already truncated to current visible chars) */
  visible: string;
  /** show blinking cursor */
  showCursor: boolean;
};

const TypingField: React.FC<TypingFieldProps> = ({
  scale,
  width,
  height,
  localFrame,
  fps,
  visible,
  showCursor,
}) => {
  const inputHeight = 88 * scale;
  const inputWidth = width * 0.6864;
  const fontSize = 38 * scale;
  const padX = 32 * scale;

  const blinkPeriod = sec(0.5, fps);
  const cursorVisible = showCursor
    ? Math.floor(localFrame / blinkPeriod) % 2 === 0
    : false;

  return (
    <div
      style={{
        position: "absolute",
        left: width / 2,
        top: height * 0.5,
        transform: "translate(-50%, -50%)",
        display: "flex",
        alignItems: "center",
        gap: 16 * scale,
      }}
    >
      <div
        style={{
          width: inputWidth,
          height: inputHeight,
          borderRadius: inputHeight / 2,
          background: FIELD_GRAY,
          display: "flex",
          alignItems: "center",
          paddingLeft: padX,
          paddingRight: padX,
          fontFamily: FONT_STACK,
          fontSize,
          color: "#1C1C1E",
          fontWeight: 500,
          letterSpacing: -0.3 * scale,
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        <span>{visible}</span>
        <span
          style={{
            display: "inline-block",
            width: 2 * scale,
            height: fontSize * 1.05,
            marginLeft: 4 * scale,
            background: IMESSAGE_BLUE,
            opacity: cursorVisible ? 1 : 0,
            transform: "translateY(2px)",
          }}
        />
      </div>
      <div
        style={{
          width: 72 * scale,
          height: 72 * scale,
          borderRadius: 36 * scale,
          background: IMESSAGE_BLUE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 ${4 * scale}px ${16 * scale}px rgba(0,122,255,0.35)`,
          flexShrink: 0,
        }}
      >
        <svg
          width={72 * scale * 0.55}
          height={72 * scale * 0.55}
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M12 19V5M12 5L5 12M12 5L19 12"
            stroke="#FFFFFF"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};

type Scene2Props = SceneProps & {
  /** Seconds inside this sequence at which the phrase typewriter should begin. */
  contentStartSec?: number;
};

// Scene 2 — 2s–5s: "and DOES ANYTHING you tell it to do"
// Typewriter forward, hold, then backspace; cursor blinks throughout.
const Scene2: React.FC<Scene2Props> = ({
  scale,
  width,
  height,
  fadeInSec,
  fadeOutAtSec,
  durationSec,
  contentStartSec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { opacity: envOpacity, scaleEnv } = useSceneEnvelope({
    fadeInSec,
    fadeOutAtSec,
    durationSec,
  });

  const phrase = "does anything you tell it to do";
  // Local time inside the phrase animation, measured from the logical scene
  // start (not the sequence start, which may begin earlier for crossfade).
  const local = frame - sec(contentStartSec, fps);
  const typeStart = 0;
  const typeEnd = sec(1.67, fps);
  const holdEnd = sec(2.33, fps);
  const backspaceEnd = sec(3, fps);

  const typeCharsPerSec = 25;
  const backspaceCharsPerSec = 40;

  let visibleCount = 0;
  if (local < 0) {
    visibleCount = 0;
  } else if (local <= typeEnd) {
    visibleCount = Math.min(
      phrase.length,
      Math.floor(((local - typeStart) / fps) * typeCharsPerSec),
    );
  } else if (local <= holdEnd) {
    visibleCount = phrase.length;
  } else {
    const elapsed = (local - holdEnd) / fps;
    const removed = Math.floor(elapsed * backspaceCharsPerSec);
    visibleCount = Math.max(0, phrase.length - removed);
  }

  const visible = phrase.slice(0, Math.max(0, visibleCount));

  return (
    <AbsoluteFill style={{ opacity: envOpacity }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: `scale(${scaleEnv})`,
          transformOrigin: "center center",
        }}
      >
        <TypingField
          scale={scale}
          width={width}
          height={height}
          localFrame={Math.max(0, local)}
          fps={fps}
          visible={visible}
          showCursor={local >= 0 && local <= backspaceEnd}
        />
      </div>
    </AbsoluteFill>
  );
};

type Scene3Props = SceneProps & {
  contentStartSec?: number;
};

// Scene 3 — 5s–8s: "schedule a date with my crush"
// Typewriter, send-button pulse, then hold.
const Scene3: React.FC<Scene3Props> = ({
  scale,
  width,
  height,
  fadeInSec,
  fadeOutAtSec,
  durationSec,
  contentStartSec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { opacity: envOpacity, scaleEnv } = useSceneEnvelope({
    fadeInSec,
    fadeOutAtSec,
    durationSec,
  });

  const phrase = "schedule a date with my crush";
  const local = frame - sec(contentStartSec, fps);
  const pulseStart = sec(2, fps);
  const pulseEnd = sec(2.5, fps);

  const typeCharsPerSec = 25;
  const visibleCount =
    local < 0
      ? 0
      : Math.min(
          phrase.length,
          Math.floor((local / fps) * typeCharsPerSec),
        );
  const visible = phrase.slice(0, Math.max(0, visibleCount));

  const inputHeight = 88 * scale;
  const inputWidth = width * 0.6864;
  const fontSize = 38 * scale;
  const padX = 32 * scale;

  const blinkPeriod = sec(0.5, fps);
  const cursorVisible =
    local >= 0 && Math.floor(local / blinkPeriod) % 2 === 0;

  const pulseSpring = spring({
    frame: local - pulseStart,
    fps,
    config: { damping: 8, stiffness: 180, mass: 0.5 },
  });
  let buttonScale = 1;
  if (local >= pulseStart && local <= pulseEnd) {
    const half = (pulseEnd - pulseStart) / 2;
    if (local - pulseStart <= half) {
      buttonScale = interpolate(
        local,
        [pulseStart, pulseStart + half],
        [1, 1.1],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        },
      );
    } else {
      buttonScale = interpolate(
        local,
        [pulseStart + half, pulseEnd],
        [1.1, 1.0],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        },
      );
    }
    buttonScale = buttonScale + (pulseSpring - 1) * 0.02;
  }

  const sendButtonSize = 72 * scale;

  // ── Bubble morph: the input + button collapse and graphic-match into a
  //    sent iMessage bubble. We measure the text width with a hidden ruler
  //    so the bubble snugly fits the phrase rather than relying on a
  //    per-char estimate. The bubble then drifts up to a "sent" position
  //    and holds, with a "Delivered" indicator fading in below.
  const morphStart = sec(2.3, fps);
  const morphEnd = sec(2.7, fps);
  const morphP = interpolate(local, [morphStart, morphEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // Bubble width is sized to fit its phrase using `measureTextEm` —
  // a per-character width lookup tuned against SF Pro Display @ 500.
  // No extra safety pad: with text centered inside the bubble, any
  // estimation slack would manifest as visible whitespace asymmetry
  // (specifically extra room on the right). Trust the lookup; if a
  // glyph overflows by 1-2px the deviation is invisible to the eye.
  const bubbleFontShrink = 0.78;
  const bubbleFontSize = fontSize * bubbleFontShrink;
  const bubbleTextWidth = measureTextEm(phrase) * bubbleFontSize;
  // Tighter horizontal padding (was 32) so the bubble snugs around
  // the text the way real iMessage bubbles do.
  const bubblePadX = 22 * scale;
  const bubbleWidth = bubbleTextWidth + bubblePadX * 2;
  // Animated font size during morph — text scales down as the bubble forms.
  const animatedFontSize = interpolate(
    morphP,
    [0, 1],
    [fontSize, bubbleFontSize],
  );
  // Bubble height shrinks slightly too, for a more natural chat-bubble shape.
  const bubbleHeight = inputHeight * 0.85;
  const animatedHeight = interpolate(
    morphP,
    [0, 1],
    [inputHeight, bubbleHeight],
  );

  // Field width: starts at full inputWidth, shrinks to bubbleWidth.
  const fieldWidth = interpolate(
    morphP,
    [0, 1],
    [inputWidth, bubbleWidth],
  );
  // Field padding: lerps from input padding to a tighter bubble padding.
  const fieldPadX = interpolate(morphP, [0, 1], [padX, bubblePadX]);
  // Field background: F2F2F7 → 007AFF, channel-wise.
  const fR = Math.round(interpolate(morphP, [0, 1], [0xf2, 0x00]));
  const fG = Math.round(interpolate(morphP, [0, 1], [0xf2, 0x7a]));
  const fB = Math.round(interpolate(morphP, [0, 1], [0xf7, 0xff]));
  const fieldBg = `rgb(${fR}, ${fG}, ${fB})`;
  // Text color: dark gray → white.
  const tR = Math.round(interpolate(morphP, [0, 1], [0x1c, 0xff]));
  const tG = Math.round(interpolate(morphP, [0, 1], [0x1c, 0xff]));
  const tB = Math.round(interpolate(morphP, [0, 1], [0x1e, 0xff]));
  const textColor = `rgb(${tR}, ${tG}, ${tB})`;
  // Send button: scales down + fades out as it folds into the bubble.
  const buttonMorphScale = interpolate(morphP, [0, 1], [1, 0]);
  const buttonOpacity = interpolate(morphP, [0, 0.7], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Row drifts up. After the morph completes, a tiny continued upward drift
  // during the held period gives the bubble a sense of being "delivered".
  const morphYOffset = interpolate(morphP, [0, 1], [0, -height * 0.06]);
  const holdStart = morphEnd;
  const holdEnd = sec(3.0, fps);
  const holdYDrift = interpolate(local, [holdStart, holdEnd], [0, -height * 0.01], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const rowYOffset = morphYOffset + holdYDrift;
  // Right-align the bubble like a real iMessage outbound.
  const rowXOffset = interpolate(morphP, [0, 1], [
    0,
    (inputWidth - bubbleWidth) / 2,
  ]);
  // Bubble shadow lifts as it forms.
  const bubbleShadow = interpolate(morphP, [0, 1], [0, 0.18]);
  // Tail extrude. The tail is animated to look like it physically grows
  // out of the bubble's bottom-right corner as the bubble morphs.
  //
  // Three combined animations sell the effect:
  //   1. scaleX  (0 → 1):  width of the visible tail past the bubble.
  //   2. scaleY  (0.35 → 1): tail's height grows with it, so it doesn't
  //      slide out as a thin sliver — it bulges out, more like a soft
  //      object squeezed through the bubble's corner.
  //   3. We track the actual bubble's morph progress on a *separate*
  //      ramp from a small back-overshoot at the end, so the tail keeps
  //      pushing outward (overshoots ~6%) and then settles — that final
  //      pop is what makes it feel like a physical extrusion finishing,
  //      matching iMessage's send animation.
  //
  // The reveal starts at morphP=0.45 (well before the morph completes,
  // so the tail grows alongside the bubble's shape change rather than
  // appearing after) and finishes at morphP=1.0.
  //
  // The tail's fill color is also tied to the bubble's animated
  // background (`fieldBg`), so during the gray→blue color morph the
  // tail tracks the bubble exactly — they always read as one shape.
  const tailRevealStart = 0.45;
  const tailRevealEnd = 1.0;
  const tailRevealRaw = interpolate(
    morphP,
    [tailRevealStart, tailRevealEnd],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  // Final-stage pop: a transient overshoot that fires as the reveal
  // completes. Implemented as a half-sine impulse centered on the morph
  // end, so the tail briefly grows ~6% beyond its settled size and then
  // returns. This is what makes the extrusion feel like it "lands" with
  // weight rather than just stopping.
  const popCenter = sec(2.7, fps); // morphEnd
  const popHalfWidth = sec(0.18, fps);
  const popFromStart = local - (popCenter - popHalfWidth);
  const popFromEnd = popCenter + popHalfWidth - local;
  const popInWindow = popFromStart > 0 && popFromEnd > 0;
  const popPhase = popInWindow
    ? popFromStart / (2 * popHalfWidth) // 0 → 1 across the window
    : 0;
  const popImpulse = popInWindow ? Math.sin(popPhase * Math.PI) : 0; // 0→1→0
  const tailPop = 1 + popImpulse * 0.06;

  const tailScaleX = tailRevealRaw * tailPop;
  // scaleY starts at 0.35 (not 0) so even at the beginning of the
  // reveal the tail has visible "mass" — a small bulge growing rather
  // than a knife-thin sliver sliding out.
  const tailScaleY =
    interpolate(tailRevealRaw, [0, 1], [0.35, 1]) * tailPop;
  // "Delivered" indicator fades in after the bubble settles. Delay
  // and fade-window match the second sent bubble's pattern (0.30s
  // pause after settle, then a 0.30s fade-in) — that timing reads as
  // "delivered receipt confidently lands" rather than rushing in
  // right behind the bubble pop.
  const deliveredOpacity = interpolate(
    local,
    [holdStart + sec(0.3, fps), holdStart + sec(0.6, fps)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  // Bubble pop: a small scale punch as the morph completes ("send" feel).
  const popSpring = spring({
    frame: local - morphEnd,
    fps,
    config: { damping: 9, stiffness: 220, mass: 0.45 },
  });
  const bubblePop = interpolate(popSpring, [0, 1], [0.94, 1]);
  // Apply the pop only at/after morph end (during morph, scale stays at 1).
  const bubbleScale = local < morphEnd ? 1 : bubblePop;

  // Sent-bubble geometry, derived from the morph progress. The
  // MessageBubble component does the actual path generation.
  const sentCornerRadius = interpolate(
    morphP,
    [0, 1],
    [inputHeight / 2, animatedHeight * 0.42],
  );
  const sentTailExtFull = sentCornerRadius * 0.5;
  const sentTailExt = sentTailExtFull * tailScaleX;
  const sentTailHook = sentCornerRadius * 0.2 * tailScaleY;

  // ── Received-message flow ────────────────────────────────────────
  // After the sent bubble settles + "Delivered" appears, we crossfade
  // "Delivered" → "Read", then a second bubble pops in from below as
  // an incoming reply. The whole stack shifts up to make room.
  //
  // Timeline (local seconds inside Scene3). The delivered/read pacing
  // mirrors the second sent bubble's: 0.30s pause after settle, 0.30s
  // fade-in, 0.35s hold, 0.15s fade-out, 0.07s gap, 0.16s Read fade-in.
  //   2.70s  morph completes (sent bubble settled)
  //   3.00s  "Delivered" begins fading in
  //   3.30s  "Delivered" fully visible
  //   3.65s  "Delivered" begins fading OUT
  //   3.80s  "Delivered" fully gone
  //   3.87s  "Read" begins fading IN (sequential, not crossfaded)
  //   4.03s  "Read" fully visible
  //   4.20s  typing #1 pops in
  //   4.40s  typing #1 fully popped in
  //   5.20s  morph start (typing → gray reply)
  //   5.45s  morph end (gray bubble settled)
  const deliveredOutStart = sec(3.65, fps);
  const deliveredOutEnd = sec(3.8, fps);
  const readInStart = sec(3.87, fps);
  const readInEnd = sec(4.03, fps);
  // Typing indicator: a small gray pill with three pulsing dots that
  // appears before the actual reply. Models real iMessage's typing UX
  // — the recipient is "composing." After ~1s of typing, the bubble
  // morphs (width-wise) into the full reply bubble: dots fade out,
  // text fades in, and the bubble's width animates from a short pill
  // to the full message width.
  const typingStart = sec(4.2, fps);
  const typingPopEnd = sec(4.4, fps); // typing bubble fully popped in
  const typingMorphStart = sec(5.2, fps); // begin width morph + content swap
  const receivedStart = typingMorphStart;
  const receivedEnd = sec(5.45, fps); // morph ends, gray bubble fully formed

  // "Delivered" fade-out — sequential, completes before "Read" starts.
  const deliveredOut = interpolate(
    local,
    [deliveredOutStart, deliveredOutEnd],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );
  const deliveredFinalOpacity = deliveredOpacity * deliveredOut;

  // "Read" fade-in — starts after "Delivered" has fully faded.
  const readIn = interpolate(local, [readInStart, readInEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  // First "Read" fades OUT just before the second blue bubble enters,
  // so older receipt indicators don't stack with the new one. iMessage
  // only shows a receipt under the latest message.
  const readFirstOutStart = sec(5.65, fps);
  const readFirstOutEnd = sec(5.8, fps);
  const readOut = interpolate(
    local,
    [readFirstOutStart, readFirstOutEnd],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );
  const readOpacity = readIn * readOut;

  // Vertical gap between sent (outbound) and received (inbound)
  // bubbles. Real iMessage uses a generous gap when the sender
  // changes — closer to the height of the receipt indicator + a
  // line-height of breathing room — so both bubbles feel like
  // distinct moments in the conversation rather than touching.
  const receivedGap = 36 * scale;

  // ── Sent bubble #2 timing (the second blue bubble, after the gray
  //    reply) ──────────────────────────────────────────────────────
  //   5.65s  conversation shifts up again; sent2 begins popping in
  //   6.40s  sent2 settled
  //   6.70s  sent2 "Delivered" begins fading in
  //   7.00s  sent2 "Delivered" fully visible
  //   7.35s  sent2 "Delivered" begins fading OUT
  //   7.50s  fully gone
  //   7.57s  sent2 "Read" begins fading IN
  //   7.73s  sent2 "Read" fully visible (held until end of scene)
  const sent2Start = sec(5.9, fps);
  const sent2End = sec(6.4, fps);
  const sent2DeliveredInStart = sec(6.7, fps);
  const sent2DeliveredInEnd = sec(7.0, fps);
  const sent2DeliveredOutStart = sec(7.35, fps);
  const sent2DeliveredOutEnd = sec(7.5, fps);
  const sent2ReadInStart = sec(7.57, fps);
  const sent2ReadInEnd = sec(7.73, fps);

  // ── Second received flow: typing → IG-tap-and-share → text replies
  //   7.90s  sent2 "Read" begins fading OUT
  //   8.10s  typing #2 pops in
  //   8.30s  typing #2 fully popped in; dots begin pulsing
  //   8.45s  IG profile begins fading in (app-open zoom)
  //   8.45s+ IG drive starts (relative to this anchor inside the
  //          InstagramProfile component): hold → scan → flick →
  //          dwell → cruise. The DWELL stage spans driveSec
  //          2.4–3.0, which in absolute terms is 10.85–11.45s.
  //   11.10s tap feedback fires on the dwelled center cell (mid-
  //          dwell so it lands while the post is centered)
  //   11.30s flight animation: cell brightens, scales/translates
  //          from its IG grid position to the chat's image-bubble
  //          target position. Lands as a gray (received) image
  //          attachment.
  //   11.90s image bubble fully settled in chat
  //   12.10s typing #2 begins morphing into the first text reply
  //   12.50s morph completes; "she posted italian food before"
  //          settled
  //   12.60s "reserving table for you two @ 7pm on friday" pops in
  //   12.95s settled
  const sent2ReadOutStart = sec(7.9, fps);
  const sent2ReadOutEnd = sec(8.1, fps);
  const typing2Start = sec(8.1, fps);
  const typing2PopEnd = sec(8.3, fps);
  // Tap + flight (the IG cell becomes a gray image bubble in chat).
  const igTapStart = sec(11.1, fps);
  const igTapEnd = sec(11.3, fps); // tap-down/up complete; flight begins
  const igFlightStart = igTapEnd;
  const igFlightEnd = sec(11.9, fps);
  // typing #2 morph (after the image attachment has settled).
  const typing2MorphStart = sec(12.1, fps);
  const typing2MorphEnd = sec(12.5, fps);

  // ── Image-attachment bubble: tap progress drivers ───────────────
  // Cell tap feedback: scale-down then back to 1.0 over the
  // igTapStart..igTapEnd window, plus a brightness ramp that takes
  // the dwelled cell from the IG background's dimmed state to full
  // saturation as the tap completes.
  const tapHalfDur = (igTapEnd - igTapStart) / 2;
  const tapDownProgress = interpolate(
    local,
    [igTapStart, igTapStart + tapHalfDur],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
  const tapUpProgress = interpolate(
    local,
    [igTapStart + tapHalfDur, igTapEnd],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
  // Cell scale: 1 → 0.94 (tap-down) → 1 (release).
  const dwelledCellTapScale =
    1 - tapDownProgress * 0.06 + tapUpProgress * 0.06;
  // Brightening: the cell sits inside the IG layer at 0.55 opacity.
  // We render a separate clone of the cell that ramps OPACITY 0→1
  // during the tap window, so by the time flight begins the clone is
  // at full color and the original (still inside the dimmed layer)
  // can fade out cleanly.
  const dwelledCellHighlightOpacity = interpolate(
    local,
    [igTapStart, igTapEnd],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );

  // ── Flight progress (cell → chat image bubble) ──────────────────
  // 0 = cell is at its IG-grid position (full size, square). 1 = it
  // has landed at the image bubble's chat position (smaller, with
  // bubble corner-radius). Interpolated with a spring-style cubic
  // ease-in-out so the motion feels physical.
  const flightProgress = interpolate(
    local,
    [igFlightStart, igFlightEnd],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
  // The original cell inside the IG layer fades out during the
  // flight so we don't see two copies (the flying clone and the
  // grid-anchored copy) stacked.
  const dwelledCellSourceOpacity = interpolate(
    local,
    [igFlightStart, igFlightStart + (igFlightEnd - igFlightStart) * 0.3],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );

  // First conversation shift (when gray bubble appears): sent drifts up
  // by half a bubble height + half a gap so sent + gray are centered
  // around the midline.
  const conversationShift1End = -(bubbleHeight / 2 + receivedGap / 2);
  const conversationShift1 = interpolate(
    local,
    [receivedStart, receivedEnd],
    [0, conversationShift1End],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  // Second conversation shift (when sent2 appears): another shift up
  // by the same amount, so the THREE bubbles end up centered with the
  // gray (middle) bubble at the midline.
  const conversationShift2Delta = -(bubbleHeight / 2 + receivedGap / 2);
  const conversationShift2 = interpolate(
    local,
    [sent2Start, sent2End],
    [0, conversationShift2Delta],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  // Third conversation shift (when typing #2 appears): another half-row
  // up so the FOUR bubbles end up balanced around the screen midline.
  const conversationShift3Delta = -(bubbleHeight / 2 + receivedGap / 2);
  const conversationShift3 = interpolate(
    local,
    [typing2Start, typing2PopEnd],
    [0, conversationShift3Delta],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  // Fourth conversation shift (when the image attachment arrives):
  // the image bubble is much taller than a normal bubble (~4.2× the
  // single-line height), so the stack needs a bigger upward drift to
  // keep things balanced around the screen midline. Timed to fire as
  // the image flies into place.
  const conversationShift4Delta = -(bubbleHeight * 1.8); // tuned empirically
  const conversationShift4 = interpolate(
    local,
    [igFlightStart, igFlightEnd],
    [0, conversationShift4Delta],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  // Fifth conversation shift (when received #3 appears, the second
  // text reply): one more small drift up to balance the new bubble.
  const conversationShift5Delta = -(bubbleHeight / 2 + 8 * scale / 2);
  const conversationShift5 = interpolate(
    local,
    [sec(12.6, fps), sec(12.95, fps)],
    [0, conversationShift5Delta],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  const conversationShift =
    conversationShift1 +
    conversationShift2 +
    conversationShift3 +
    conversationShift4 +
    conversationShift5;

  // The typing-indicator-then-message bubble pops in at `typingStart`
  // (as a small pill with three pulsing dots) and STAYS visible
  // throughout, morphing into the full message bubble at
  // `typingMorphStart`. So the spring and opacity drivers below track
  // typingStart, not receivedStart.
  const receivedSpring = spring({
    frame: local - typingStart,
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.55 },
  });
  const receivedScale = interpolate(receivedSpring, [0, 1], [0.85, 1]);
  const receivedOpacity = interpolate(
    local,
    [typingStart, typingStart + sec(0.18, fps)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  // Typing-indicator content: width morph + dots-out + text-in.
  // typingMorphP: 0 = typing state (small pill, dots, no text)
  //                1 = message state (full pill, no dots, text)
  const typingMorphP = interpolate(
    local,
    [typingMorphStart, receivedEnd],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );

  // Dot-wave: each of the three dots pulses scale+opacity in
  // sequence, repeating every ~0.9s. The wave is a sine-driven
  // function with a stagger between dots.
  const dotWavePeriodFrames = sec(0.9, fps);
  const dotWavePhase = ((local - typingPopEnd) / dotWavePeriodFrames) % 1;
  // Each dot is offset by a third of the period; we then map a
  // shifted phase through a smooth pulse curve.
  const computeDotState = (dotIndex: 0 | 1 | 2) => {
    // Dots animate only after the bubble has fully popped in.
    if (local < typingPopEnd) {
      return { scale: 0.85, opacity: 0.45 };
    }
    const p = (dotWavePhase + dotIndex / 3) % 1;
    // 0..1 phase → smooth bell-curve pulse via raised sine. Peaks
    // around p=0.25 (when dot is most prominent).
    const pulse = Math.max(0, Math.sin(p * Math.PI * 2)); // 0..1..0..0
    return {
      scale: 0.85 + pulse * 0.25, // 0.85 → 1.10
      opacity: 0.45 + pulse * 0.55, // 0.45 → 1.00
    };
  };
  // Dots fade out as the bubble morphs into a message.
  const dotsOpacity = interpolate(
    typingMorphP,
    [0, 0.5],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Text fades in only AFTER the bubble has grown nearly to its
  // final width — otherwise the (full-length) text would be visible
  // while the bubble is still narrow, spilling out of the bubble's
  // left and right edges. Even with a small fade-in window the text
  // overlay is also clipped via overflow:hidden as a safety belt.
  const messageTextOpacity = interpolate(
    typingMorphP,
    [0.85, 1],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Sent2 pop-in: same spring config as received, so the conversation
  // tempo stays consistent.
  const sent2Spring = spring({
    frame: local - sent2Start,
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.55 },
  });
  const sent2Scale = interpolate(sent2Spring, [0, 1], [0.85, 1]);
  const sent2Opacity = interpolate(
    local,
    [sent2Start, sent2Start + sec(0.18, fps)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  // Sent2 receipt indicators (Delivered → Read), same sequential
  // pattern as the first sent bubble.
  const sent2DeliveredIn = interpolate(
    local,
    [sent2DeliveredInStart, sent2DeliveredInEnd],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  const sent2DeliveredOut = interpolate(
    local,
    [sent2DeliveredOutStart, sent2DeliveredOutEnd],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );
  const sent2DeliveredOpacity = sent2DeliveredIn * sent2DeliveredOut;
  const sent2ReadIn = interpolate(
    local,
    [sent2ReadInStart, sent2ReadInEnd],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  // sent2 "Read" fades out before typing #2 enters, mirroring how
  // the first sent bubble's "Read" cleared before sent2 arrived.
  // iMessage only shows a receipt under the latest message.
  const sent2ReadOut = interpolate(
    local,
    [sent2ReadOutStart, sent2ReadOutEnd],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );
  const sent2ReadOpacity = sent2ReadIn * sent2ReadOut;

  // ── Typing indicator #2 (second gray reply) ─────────────────────
  // Pops in at typing2Start, dots pulse from typing2PopEnd through
  // typing2MorphStart, then the bubble morphs (width AND height) into
  // the multi-line message bubble at typing2MorphEnd.
  const typing2Spring = spring({
    frame: local - typing2Start,
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.55 },
  });
  const typing2Scale = interpolate(typing2Spring, [0, 1], [0.85, 1]);
  // Typing #2 stays visible throughout — it slides DOWN to make
  // room for the image attachment instead of fading out, then later
  // morphs into the first text reply ("she posted italian food
  // before"). So the only opacity driver is the entry fade-in.
  const typing2Opacity = interpolate(
    local,
    [typing2Start, typing2Start + sec(0.18, fps)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  // Width-and-height morph progress for typing #2. 0 = typing pill
  // (small width, single-line height, dots visible). 1 = settled
  // multi-line message bubble (wrapped width, multi-line height,
  // text visible).
  const typing2MorphP = interpolate(
    local,
    [typing2MorphStart, typing2MorphEnd],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
  // Dots fade out during the first half of the morph.
  const dots2OutOpacity = interpolate(
    typing2MorphP,
    [0, 0.5],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Text fades in only AFTER the bubble has reached ~85% of its
  // final size — same approach as received #1 — so the (multi-line)
  // text never spills out of an under-sized bubble.
  const message2TextOpacity = interpolate(
    typing2MorphP,
    [0.85, 1],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Instagram profile background uses an "iOS open app" entry: the
  // page starts as a small rounded card in the lower-right of the
  // canvas (where an app icon would live on a home screen) and
  // expands outward with a spring-driven scale, while its corner
  // radius shrinks from icon-rounded to flat. Reads like the agent
  // tapping the IG icon while drafting the message.
  //
  // Three drivers compose the entry:
  //   - openProgress (0→1): a spring-eased ramp that drives both
  //     scale and corner-radius together so they animate in lockstep.
  //   - igFeedOpacity: a fast opacity ramp early in the entry so the
  //     small starting card isn't an invisible point.
  const igFeedFadeStart = typing2PopEnd + sec(0.15, fps);
  const igOpenSpring = spring({
    frame: local - igFeedFadeStart,
    fps,
    config: { damping: 16, stiffness: 110, mass: 0.65 },
  });
  // Spring drives a smooth 0→1 with a small overshoot/settle.
  const openProgress = igOpenSpring;
  // Scale: 0.15 (icon-sized) → 1.0 (full screen).
  const igOpenScale = interpolate(openProgress, [0, 1], [0.15, 1]);
  // Corner radius: 80px (iOS app icon corner) → 0 (flush). Both
  // values scale-aware so the visual feel stays consistent across
  // canvas sizes.
  const igOpenRadius = interpolate(openProgress, [0, 1], [80 * scale, 0]);
  // Opacity ramp: gets visible quickly during the first ~0.18s of
  // the open so we don't render a tiny invisible point. Holds at
  // its final value (0.55) once visible.
  const igFeedFadeIn = interpolate(
    local,
    [igFeedFadeStart, igFeedFadeStart + sec(0.18, fps)],
    [0, 0.55],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  // Exit transition: as the image flies into the chat, the IG layer
  // fades out and drifts upward by ~50px. Reads as the profile page
  // "lifting away" once the user has tapped what they wanted, so the
  // chat replies that follow have a clean white background instead
  // of competing with a still-scrolling feed.
  const igExitFadeStart = igFlightStart;
  const igExitFadeEnd = igFlightEnd + sec(0.1, fps);
  const igExitFadeMul = interpolate(
    local,
    [igExitFadeStart, igExitFadeEnd],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );
  const igFeedOpacity = igFeedFadeIn * igExitFadeMul;
  // Upward drift during the exit. Anchored to the same window as the
  // exit fade so they land together. Subtle (~50px scale-aware) — the
  // page rises slightly as it dissolves.
  const igExitDriftY = interpolate(
    local,
    [igExitFadeStart, igExitFadeEnd],
    [0, -50 * scale],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );

  // ── Dwelled cell identification ────────────────────────────────
  // Replicates the InstagramProfile geometry so we can compute which
  // grid cell will be visually centered on screen during the dwell
  // phase, and where it sits in screen coordinates. This anchors the
  // tap/flight animations to the right cell.
  const igLayout = computeProfileLayout(width, scale);
  const igMaxScroll = Math.max(0, igLayout.totalContentH - height);
  const igDwellTarget = Math.min(igMaxScroll, igMaxScroll * 0.6);
  // The cell whose vertical center is closest to the screen midline
  // during the dwell (when pageY = -igDwellTarget). Solve for the
  // row whose layoutY ≈ height/2 + igDwellTarget. Always pick column
  // 1 (middle of 3) so the cell is also centered horizontally.
  const dwelledRow = Math.max(
    0,
    Math.min(
      igLayout.gridRows - 1,
      Math.round(
        (height / 2 + igDwellTarget - igLayout.headerTotalH - igLayout.cellSize / 2) /
          (igLayout.cellSize + igLayout.gridGap),
      ),
    ),
  );
  const dwelledCellIndex = dwelledRow * igLayout.gridCols + 1; // middle column
  const dwelledCellColor =
    PROFILE_GRID_COLORS[dwelledCellIndex % PROFILE_GRID_COLORS.length];
  // Cell screen position during dwell. Layout coords minus the
  // current page-Y (which is -igDwellTarget during the dwell stage).
  const dwelledCellLayoutX = cellLayoutX(dwelledCellIndex, igLayout);
  const dwelledCellLayoutY = cellLayoutY(dwelledCellIndex, igLayout);
  // Screen-space center of the cell during the dwell — used as the
  // flight start point.
  const dwelledCellScreenX = dwelledCellLayoutX;
  const dwelledCellScreenY = dwelledCellLayoutY - igDwellTarget;
  // Dots animate via the same sine-driven pulse as typing #1, but
  // anchored to typing2PopEnd so the wave starts fresh for this
  // bubble.
  const dot2WavePhase =
    ((local - typing2PopEnd) / dotWavePeriodFrames) % 1;
  const computeDot2State = (dotIndex: 0 | 1 | 2) => {
    if (local < typing2PopEnd) {
      return { scale: 0.85, opacity: 0.45 };
    }
    const p = (dot2WavePhase + dotIndex / 3) % 1;
    const pulse = Math.max(0, Math.sin(p * Math.PI * 2));
    return {
      scale: 0.85 + pulse * 0.25,
      opacity: 0.45 + pulse * 0.55,
    };
  };

  // Received-bubble dimensions (settled — no morph for this one).
  const receivedPhrase = "added to calendar + invited her";
  const receivedFontSize = bubbleFontSize;
  const receivedTextWidth = measureTextEm(receivedPhrase) * receivedFontSize;
  const receivedPadX = bubblePadX;
  const receivedWidth = receivedTextWidth + receivedPadX * 2;
  const receivedHeight = bubbleHeight;
  const receivedCornerRadius = receivedHeight * 0.42;
  const receivedTailExt = receivedCornerRadius * 0.5;
  const receivedTailHook = receivedCornerRadius * 0.2;

  // Typing-indicator bubble dimensions. Smaller than the message
  // bubble — just wide enough to fit three dots with comfortable
  // padding. Width morphs to receivedWidth across the typing→message
  // transition.
  const dotRadius = 8 * scale;
  const dotGap = 12 * scale;
  const typingInteriorW = dotRadius * 6 + dotGap * 2; // three dots + two gaps
  const typingPadX = 26 * scale;
  const typingBubbleWidth = typingInteriorW + typingPadX * 2;
  // Typing indicator #2 reuses the same pill width as typing #1
  // (`typingBubbleWidth`) directly — the longer-message variant
  // animates outward from that same starting width via
  // `typing2AnimatedW`.
  // Animated bubble width (typing → message). Anchored to the LEFT
  // edge so the bubble grows rightward — the tail stays put on the
  // left, the right edge expands outward.
  const animatedBubbleW = interpolate(
    typingMorphP,
    [0, 1],
    [typingBubbleWidth, receivedWidth],
  );

  // Sent2 (second blue bubble) dimensions — same styling as the first
  // sent bubble's settled state, just with a different phrase.
  const sent2Phrase = "find a dinner spot she'll like";
  const sent2FontSize = bubbleFontSize;
  const sent2TextWidth = measureTextEm(sent2Phrase) * sent2FontSize;
  const sent2PadX = bubblePadX;
  const sent2Width = sent2TextWidth + sent2PadX * 2;
  const sent2Height = bubbleHeight;
  const sent2CornerRadius = sent2Height * 0.42;
  const sent2TailExt = sent2CornerRadius * 0.5;
  const sent2TailHook = sent2CornerRadius * 0.2;

  // ── Received bubbles #2 and #3 ──────────────────────────────────
  // Real conversations come in as multiple short messages, not one
  // long wrapped one. Split the reply into two consecutive gray
  // bubbles: typing #2 morphs into received #2 (no tail, since
  // another bubble is coming right after), and received #3 pops in
  // below with the tail (signaling end of the burst).
  const received2Phrase = "she posted italian food before";
  const received2FontSize = bubbleFontSize;
  const received2PadX = bubblePadX;
  const received2TextWidth =
    measureTextEm(received2Phrase) * received2FontSize;
  const received2Width = received2TextWidth + received2PadX * 2;
  const received2Height = bubbleHeight;
  const received2CornerRadius = received2Height * 0.42;
  // Received #2 has NO visible tail — it's the first of a two-bubble
  // burst from the same sender, so iMessage convention hides the
  // tail (only the LAST bubble in a burst shows the tail).
  const received2TailExt = 0;
  const received2TailHook = 0;

  // Received bubble #3 — second message in the burst. Gets the tail.
  const received3Phrase = "reserving table for you two @ 7pm on friday";
  const received3FontSize = bubbleFontSize;
  const received3PadX = bubblePadX;
  const received3TextWidth =
    measureTextEm(received3Phrase) * received3FontSize;
  const received3Width = received3TextWidth + received3PadX * 2;
  const received3Height = bubbleHeight;
  const received3CornerRadius = received3Height * 0.42;
  const received3TailExt = received3CornerRadius * 0.5;
  const received3TailHook = received3CornerRadius * 0.2;

  // Received #3 timing: pops in shortly after typing #2 morphs into
  // the first text reply.
  const received3Start = sec(12.6, fps);
  const received3Spring = spring({
    frame: local - received3Start,
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.55 },
  });
  const received3Scale = interpolate(received3Spring, [0, 1], [0.85, 1]);
  const received3Opacity = interpolate(
    local,
    [received3Start, received3Start + sec(0.18, fps)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  // Animated bubble dimensions for the typing #2 → received #2 morph.
  // Now single-line (the long phrase was split into two messages),
  // so only the WIDTH morphs — height stays at bubbleHeight.
  const typing2AnimatedW = interpolate(
    typing2MorphP,
    [0, 1],
    [typingBubbleWidth, received2Width],
  );
  const typing2AnimatedH = bubbleHeight;

  // ── Image-attachment bubble dimensions ──────────────────────────
  // A square-ish gray bubble that contains the IG post image. Sized
  // similar to a real iMessage image attachment — wide enough to read
  // but not full-bleed, with bubble-style rounded corners.
  const imageBubbleSize = bubbleHeight * 4.2; // roughly 315 @ 1080 canvas
  const imageBubbleCornerRadius = bubbleHeight * 0.42;

  // Distance between bubble CENTERS (used in absolute positioning).
  // Add half of each bubble's height plus the gap.
  const receivedYOffset = bubbleHeight / 2 + receivedGap + receivedHeight / 2;
  // Sent2 sits another full row below the gray bubble.
  const sent2YOffset =
    receivedYOffset + receivedHeight / 2 + receivedGap + sent2Height / 2;
  // Image attachment row.
  const imageBubbleTopAnchorY =
    sent2YOffset + sent2Height / 2 + receivedGap;
  const imageBubbleYOffset = imageBubbleTopAnchorY + imageBubbleSize / 2;
  // Same-sender gap between consecutive gray bubbles (image → text replies).
  const sameSenderGap = 8 * scale;
  // Typing #2 has TWO row positions:
  //   - Before the image arrives, it pulses at the image's row
  //     (`typing2TopAnchorBefore` — centered in the image slot).
  //   - During/after the flight, it slides DOWN to the row below the
  //     image so the image can take its place. This is the position
  //     where it eventually morphs into "she posted italian food
  //     before" (received #2).
  // The slide is driven by `flightProgress` so typing #2 moves in
  // lockstep with the image flying in.
  const typing2TopAnchorBefore = imageBubbleTopAnchorY;
  const typing2TopAnchorAfter =
    imageBubbleTopAnchorY + imageBubbleSize + sameSenderGap;
  const typing2TopAnchorY = interpolate(
    flightProgress,
    [0, 1],
    [typing2TopAnchorBefore, typing2TopAnchorAfter],
  );
  const typing2YOffset = typing2TopAnchorY + typing2AnimatedH / 2;
  // Received #3 sits below typing #2 (which morphs into received #2)
  // with another same-sender gap. Anchored to typing #2's settled
  // (post-slide) row so it doesn't move when the slide happens.
  const received3YOffset =
    typing2TopAnchorAfter + received2Height + sameSenderGap + received3Height / 2;

  // Anchor for the entire conversation, so receipt indicators and the
  // received bubble all move with the sent bubble when it scrolls up.
  const sentBubbleX = width / 2 + rowXOffset;
  const sentBubbleY = height * 0.5 + rowYOffset + conversationShift;
  // Right edge of the settled sent bubble, in screen coords. The row
  // (a flex container) is centered at sentBubbleX and contains the
  // bubble + send button as siblings. The send button has scaled to 0
  // visually but still occupies its layout space, so the bubble sits
  // on the LEFT half of the row and its right edge is offset
  // accordingly:
  //   row width        = bubbleWidth + sendButtonSize  (gap is 0 after
  //                      morph completes)
  //   row left edge    = sentBubbleX - rowWidth/2
  //   bubble right     = row left + bubbleWidth
  //                    = sentBubbleX + (bubbleWidth - sendButtonSize)/2
  // This is what we use for chatEdgeMargin so the received bubble's
  // left inset and the sent2 bubble's right anchor line up exactly
  // with the first sent bubble's actual visible right edge.
  const sentBubbleRight =
    sentBubbleX + (bubbleWidth - sendButtonSize) / 2;
  const sentBubbleBottom = sentBubbleY + bubbleHeight / 2;

  // Mirror the sent bubble's right-edge inset on the left side, so
  // the gray (received) bubble's left edge sits the same distance
  // from the screen's left edge as the blue (sent) bubble's right
  // edge sits from the screen's right edge. This makes the
  // conversation feel symmetric — both bubbles tucked the same
  // amount inward from their respective sides.
  const chatEdgeMargin = width - sentBubbleRight;
  const receiptIndicatorX = sentBubbleRight - 20 * scale;
  const receiptIndicatorY = sentBubbleBottom + 3 * scale;
  const receiptStyle: React.CSSProperties = {
    position: "absolute",
    left: receiptIndicatorX,
    top: receiptIndicatorY,
    transform: "translateX(-100%)",
    fontFamily: FONT_STACK,
    fontSize: 22 * scale,
    color: "rgba(60, 60, 67, 0.6)",
    fontWeight: 500,
    letterSpacing: 0.3,
  };

  return (
    <AbsoluteFill style={{ opacity: envOpacity }}>
      {/* Instagram profile-page background — appears AFTER typing #2
          has popped in and pulsed for a beat, with an iOS-style
          "open app" entry: starts as a small rounded card anchored to
          the lower-right of the canvas (where an app icon lives on a
          home screen) and expands outward into the full profile page.
          Sits behind every bubble (rendered first in the AbsoluteFill). */}
      {igFeedOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width,
            height,
            // Transform-origin lower-right so the card grows OUT of
            // where an app icon would sit on the iOS home screen.
            // The "Instagram" icon on most home screens is in the
            // bottom rows, generally toward the right side.
            transformOrigin: `${width * 0.78}px ${height * 0.82}px`,
            transform: `translateY(${igExitDriftY}px) scale(${igOpenScale})`,
            // Round the corners during the open so the card looks
            // like an iOS app icon shrinking up. As the scale
            // approaches 1, the corner radius reaches 0.
            borderRadius: igOpenRadius,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <InstagramProfile
            driveFrame={local - igFeedFadeStart}
            fps={fps}
            width={width}
            height={height}
            scale={scale}
            opacity={igFeedOpacity}
            tappedCellIndex={dwelledCellIndex}
            tappedCellScale={dwelledCellTapScale}
            // Hide the original cell during flight — a brighter
            // clone (rendered separately, above the IG layer) takes
            // over. dwelledCellSourceOpacity ramps 1→0 during the
            // flight, so the cell fades out as the clone flies away.
            tappedCellOpacity={dwelledCellSourceOpacity}
          />
        </div>
      )}

      {/* Sent message row (input → bubble morph + send button). */}
      <div
        style={{
          position: "absolute",
          left: sentBubbleX,
          top: sentBubbleY,
          transform: `translate(-50%, -50%) scale(${scaleEnv * bubbleScale})`,
          display: "flex",
          alignItems: "center",
          gap: 16 * scale * (1 - morphP),
        }}
      >
        <MessageBubble
          width={fieldWidth}
          height={animatedHeight}
          cornerRadius={sentCornerRadius}
          tailExt={sentTailExt}
          tailHook={sentTailHook}
          tailScaleX={tailScaleX}
          tailSide="right"
          bubbleColor={fieldBg}
          textColor={textColor}
          fontSize={animatedFontSize}
          paddingX={fieldPadX}
          letterSpacing={-0.3 * scale}
          text={visible}
          // Left-align during typing (morphP=0, wide input field) so
          // the typewriter cursor appears at the natural text-end
          // position. Center once the morph completes so any width
          // estimation slack doesn't show as right-side whitespace.
          textAlign={morphP < 1 ? "start" : "center"}
          cursor={{
            visible: cursorVisible && morphP === 0,
            color: IMESSAGE_BLUE,
            widthPx: 2 * scale,
          }}
          shadowOpacity={bubbleShadow}
          shadowBlur={20 * scale}
          shadowOffsetY={4 * scale}
          filterId="bubbleShadow-sent"
        />
        <div
          style={{
            width: sendButtonSize,
            height: sendButtonSize,
            borderRadius: sendButtonSize / 2,
            background: IMESSAGE_BLUE,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 ${4 * scale}px ${16 * scale}px rgba(0,122,255,0.35)`,
            transform: `scale(${buttonScale * buttonMorphScale})`,
            opacity: buttonOpacity,
            flexShrink: 0,
          }}
        >
          <svg
            width={sendButtonSize * 0.55}
            height={sendButtonSize * 0.55}
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M12 19V5M12 5L5 12M12 5L19 12"
              stroke="#FFFFFF"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* "Delivered" — fades in after settle, then fades out into "Read". */}
      {deliveredFinalOpacity > 0 && (
        <div style={{ ...receiptStyle, opacity: deliveredFinalOpacity }}>
          Delivered
        </div>
      )}
      {/* "Read" — fades in as "Delivered" fades out. */}
      {readOpacity > 0 && (
        <div style={{ ...receiptStyle, opacity: readOpacity }}>Read</div>
      )}

      {/* Typing indicator → received reply bubble.
          Phase 1 (typingStart..typingMorphStart):
            - Bubble pops in as a small gray pill on the LEFT.
            - Three dots pulse in sequence (typewriter feel).
          Phase 2 (typingMorphStart..receivedEnd):
            - Bubble width morphs outward (anchored to its left edge,
              so the tail stays put and the right edge expands).
            - Dots fade out, then text fades in.
          After phase 2, the bubble IS the received message bubble. */}
      {receivedOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            // Anchor the bubble's LEFT edge to chatEdgeMargin and let
            // the WIDTH animate outward, so the bubble grows
            // rightward (the tail at bottom-left stays anchored).
            left: chatEdgeMargin + animatedBubbleW / 2,
            top: sentBubbleY + receivedYOffset,
            transform: `translate(-50%, -50%) scale(${receivedScale})`,
            opacity: receivedOpacity,
          }}
        >
          <div style={{ position: "relative" }}>
            <MessageBubble
              width={animatedBubbleW}
              height={receivedHeight}
              cornerRadius={receivedCornerRadius}
              tailExt={receivedTailExt}
              tailHook={receivedTailHook}
              tailScaleX={1}
              tailSide="left"
              bubbleColor={RECEIVED_GRAY}
              textColor={RECEIVED_TEXT}
              fontSize={receivedFontSize}
              paddingX={receivedPadX}
              letterSpacing={-0.3 * scale}
              // We control text/dots via overlays below, not the
              // bubble's built-in text slot — that lets us crossfade
              // them through the morph.
              text=""
              shadowOpacity={0.08}
              shadowBlur={16 * scale}
              shadowOffsetY={3 * scale}
              filterId="bubbleShadow-received"
            />
            {/* Three pulsing dots, overlaid on top of the bubble. */}
            {dotsOpacity > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: typingBubbleWidth,
                  height: receivedHeight,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: dotGap,
                  pointerEvents: "none",
                  opacity: dotsOpacity,
                }}
              >
                {[0, 1, 2].map((i) => {
                  const { scale: ds, opacity: dop } = computeDotState(
                    i as 0 | 1 | 2,
                  );
                  return (
                    <div
                      key={i}
                      style={{
                        width: dotRadius * 2,
                        height: dotRadius * 2,
                        borderRadius: dotRadius,
                        // Slightly darker than the bubble fill, in the
                        // gray range iMessage uses for typing dots.
                        background: "#8E8E93",
                        opacity: dop,
                        transform: `scale(${ds})`,
                      }}
                    />
                  );
                })}
              </div>
            )}
            {/* Text overlay — fades in once the bubble is ~85%
                expanded. Text is clipped to the bubble's interior
                via overflow:hidden + border-radius so even during
                the brief tail of the morph (when the bubble is still
                slightly narrower than the text) any overflowing
                glyphs are clipped to the bubble shape rather than
                spilling out into the canvas. */}
            {messageTextOpacity > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: animatedBubbleW,
                  height: receivedHeight,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingLeft: receivedPadX,
                  paddingRight: receivedPadX,
                  fontFamily: FONT_STACK,
                  fontSize: receivedFontSize,
                  color: RECEIVED_TEXT,
                  fontWeight: 500,
                  letterSpacing: -0.3 * scale,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  opacity: messageTextOpacity,
                  overflow: "hidden",
                  borderRadius: receivedCornerRadius,
                }}
              >
                {receivedPhrase}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Second sent bubble — pinned to the same right-edge inset as
          the first sent bubble, sitting one row below the gray reply.
          Pops in with a spring-driven scale + opacity, then has its
          own Delivered → Read receipt swap. */}
      {sent2Opacity > 0 && (
        <>
          <div
            style={{
              position: "absolute",
              // Anchor the right edge to the same inset as the first
              // sent bubble: `width - chatEdgeMargin` = sentBubbleRight.
              // Subtract sent2Width/2 to account for translate(-50%).
              left: width - chatEdgeMargin - sent2Width / 2,
              top: sentBubbleY + sent2YOffset,
              transform: `translate(-50%, -50%) scale(${sent2Scale})`,
              opacity: sent2Opacity,
            }}
          >
            <MessageBubble
              width={sent2Width}
              height={sent2Height}
              cornerRadius={sent2CornerRadius}
              tailExt={sent2TailExt}
              tailHook={sent2TailHook}
              tailScaleX={1}
              tailSide="right"
              bubbleColor={IMESSAGE_BLUE}
              textColor="#FFFFFF"
              fontSize={sent2FontSize}
              paddingX={sent2PadX}
              letterSpacing={-0.3 * scale}
              text={sent2Phrase}
              shadowOpacity={0.18}
              shadowBlur={20 * scale}
              shadowOffsetY={4 * scale}
              filterId="bubbleShadow-sent2"
            />
          </div>
          {/* Sent2 "Delivered" — fades in after settle, then fades out
              into "Read". Right-aligned to sent2's right edge. */}
          {sent2DeliveredOpacity > 0 && (
            <div
              style={{
                ...receiptStyle,
                // Same right-edge inset as sent2 minus the standard
                // 50px nudge used for the first bubble's receipt.
                left: width - chatEdgeMargin - 20 * scale,
                top:
                  sentBubbleY +
                  sent2YOffset +
                  sent2Height / 2 +
                  3 * scale,
                opacity: sent2DeliveredOpacity,
              }}
            >
              Delivered
            </div>
          )}
          {sent2ReadOpacity > 0 && (
            <div
              style={{
                ...receiptStyle,
                left: width - chatEdgeMargin - 20 * scale,
                top:
                  sentBubbleY +
                  sent2YOffset +
                  sent2Height / 2 +
                  3 * scale,
                opacity: sent2ReadOpacity,
              }}
            >
              Read
            </div>
          )}
        </>
      )}

      {/* Typing indicator #2 → received #2 (long, multi-line message).
          Phase 1 (typing2Start..typing2MorphStart):
            - Pops in as a small gray pill with three pulsing dots,
              sitting one row below sent2.
          Phase 2 (typing2MorphStart..typing2MorphEnd):
            - Bubble width AND height morph outward — width expands
              rightward to wrap the long phrase, height expands
              UPWARD so the bubble's bottom-left tail stays anchored
              and new text rows materialize above the dot row.
            - Dots fade out; multi-line text fades in once the
              bubble has reached ~85% of its final size. */}
      {typing2Opacity > 0 && (
        <div
          style={{
            position: "absolute",
            // Anchor to the bubble's TOP-LEFT corner (chatEdgeMargin
            // from the screen left, typing2TopAnchorY from
            // sentBubbleY). Since we use translate(-50%, -50%) the
            // div is positioned by its center, so we add half the
            // animated dimensions to convert from top-left to center.
            left: chatEdgeMargin + typing2AnimatedW / 2,
            top: sentBubbleY + typing2YOffset,
            transform: `translate(-50%, -50%) scale(${typing2Scale})`,
            opacity: typing2Opacity,
          }}
        >
          <div style={{ position: "relative" }}>
            <MessageBubble
              width={typing2AnimatedW}
              height={typing2AnimatedH}
              cornerRadius={received2CornerRadius}
              tailExt={received2TailExt}
              tailHook={received2TailHook}
              tailScaleX={1}
              tailSide="left"
              bubbleColor={RECEIVED_GRAY}
              textColor={RECEIVED_TEXT}
              fontSize={received2FontSize}
              paddingX={received2PadX}
              letterSpacing={-0.3 * scale}
              text=""
              shadowOpacity={0.08}
              shadowBlur={16 * scale}
              shadowOffsetY={3 * scale}
              filterId="bubbleShadow-typing2"
            />
            {/* Three pulsing dots — anchored to the BOTTOM of the
                bubble so they stay at the typing-indicator position
                even as the bubble grows upward during morph. They
                fade out via dots2OutOpacity once the morph kicks in. */}
            {dots2OutOpacity > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  bottom: 0,
                  width: typing2AnimatedW,
                  height: bubbleHeight,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: dotGap,
                  pointerEvents: "none",
                  opacity: dots2OutOpacity,
                }}
              >
                {[0, 1, 2].map((i) => {
                  const { scale: ds, opacity: dop } = computeDot2State(
                    i as 0 | 1 | 2,
                  );
                  return (
                    <div
                      key={i}
                      style={{
                        width: dotRadius * 2,
                        height: dotRadius * 2,
                        borderRadius: dotRadius,
                        background: "#8E8E93",
                        opacity: dop,
                        transform: `scale(${ds})`,
                      }}
                    />
                  );
                })}
              </div>
            )}
            {/* Multi-line message text — fades in once the bubble
                has reached ~85% of its final size. Each wrapped line
                is rendered as its own div so we get explicit line
                breaks without relying on flex/text wrapping at runtime. */}
            {message2TextOpacity > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: typing2AnimatedW,
                  height: typing2AnimatedH,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingLeft: received2PadX,
                  paddingRight: received2PadX,
                  fontFamily: FONT_STACK,
                  fontSize: received2FontSize,
                  color: RECEIVED_TEXT,
                  fontWeight: 500,
                  letterSpacing: -0.3 * scale,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  opacity: message2TextOpacity,
                  overflow: "hidden",
                  borderRadius: received2CornerRadius,
                }}
              >
                {received2Phrase}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Received bubble #3 — second text reply in the same-sender
          burst, popping in below typing #2 (which morphs into
          received #2). Uses a tighter same-sender gap (8px) instead
          of the full inter-sender gap. */}
      {received3Opacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: chatEdgeMargin + received3Width / 2,
            top: sentBubbleY + received3YOffset,
            transform: `translate(-50%, -50%) scale(${received3Scale})`,
            opacity: received3Opacity,
          }}
        >
          <MessageBubble
            width={received3Width}
            height={received3Height}
            cornerRadius={received3CornerRadius}
            tailExt={received3TailExt}
            tailHook={received3TailHook}
            tailScaleX={1}
            tailSide="left"
            bubbleColor={RECEIVED_GRAY}
            textColor={RECEIVED_TEXT}
            fontSize={received3FontSize}
            paddingX={received3PadX}
            letterSpacing={-0.3 * scale}
            text={received3Phrase}
            shadowOpacity={0.08}
            shadowBlur={16 * scale}
            shadowOffsetY={3 * scale}
            filterId="bubbleShadow-received3"
          />
        </div>
      )}

      {/* Image attachment "flight clone" — a single element that
          covers three phases:
            1. Before tap (igTapStart): invisible.
            2. Tap window (igTapStart..igTapEnd): renders ON TOP of
               the dwelled IG cell, brightening from 0 to full
               opacity. Implements the "this is the post you're
               focused on" highlight.
            3. Flight (igFlightStart..igFlightEnd): the clone
               translates + scales from the cell's screen position
               and size to the image bubble's destination position
               and size, while morphing its corner radius from 0
               (square cell) to the bubble's corner radius.
            4. After flight (>= igFlightEnd): clone holds at the
               image bubble destination indefinitely, becoming the
               settled image attachment in the chat.

          Interpolated values:
            x:        dwelledCellScreenX → imageBubbleX
            y:        dwelledCellScreenY → imageBubbleY (sentBubbleY
                       has already shifted up via conversationShift4)
            size:     cellSize → imageBubbleSize
            radius:   0 → imageBubbleCornerRadius
            opacity:  0 → 1 during tap, holds at 1 after
       */}
      {dwelledCellHighlightOpacity > 0 && (
        (() => {
          const imageBubbleX =
            chatEdgeMargin + imageBubbleSize / 2;
          const imageBubbleY = sentBubbleY + imageBubbleYOffset;
          const cloneX = interpolate(
            flightProgress,
            [0, 1],
            [dwelledCellScreenX, imageBubbleX],
          );
          const cloneY = interpolate(
            flightProgress,
            [0, 1],
            [dwelledCellScreenY, imageBubbleY],
          );
          const cloneSize = interpolate(
            flightProgress,
            [0, 1],
            [igLayout.cellSize, imageBubbleSize],
          );
          const cloneRadius = interpolate(
            flightProgress,
            [0, 1],
            [0, imageBubbleCornerRadius],
          );
          // During tap, mirror the cell's tap-pulse scale.
          const tapScale = local < igFlightStart ? dwelledCellTapScale : 1;
          return (
            <div
              style={{
                position: "absolute",
                left: cloneX,
                top: cloneY,
                width: cloneSize,
                height: cloneSize,
                borderRadius: cloneRadius,
                background: dwelledCellColor,
                transform: `translate(-50%, -50%) scale(${tapScale})`,
                opacity: dwelledCellHighlightOpacity,
                boxShadow:
                  flightProgress > 0.5
                    ? `0 ${3 * scale}px ${16 * scale}px rgba(0,0,0,0.08)`
                    : "none",
                pointerEvents: "none",
              }}
            />
          );
        })()
      )}
    </AbsoluteFill>
  );
};

type MessagesAdContentProps = {
  /** Layout width — drives `scale` and all positioning. May differ from the
   * actual composition width when laying out into a sub-region (e.g. the
   * 9:16 mobile-safe area inside a 16:9 canvas). */
  layoutWidth: number;
  layoutHeight: number;
};

const MessagesAdContent: React.FC<MessagesAdContentProps> = ({
  layoutWidth,
  layoutHeight,
}) => {
  const { fps } = useVideoConfig();
  const scale = layoutWidth / 1080;

  // Sequence boundaries are extended by `xfade` seconds on each side of the
  // logical scene end so adjacent scenes overlap and crossfade rather than
  // hard-cutting. The internal frame=0 of each Sequence still aligns with
  // the logical scene start (we use `from` exactly at the start), and we
  // wrap with a parent Sequence whose duration includes the trailing tail.
  const xfade = 0.35;

  return (
    <AbsoluteFill style={{ background: BG_WHITE }}>
      {/* Scene 1 — 0s–2s: logo spin → morph → slide + input fade-in.
          No fade-out: Scene 2 hard-cuts in at 2s with the identical chat-row
          geometry, so the input/button stay visually persistent across the
          boundary. */}
      <Sequence from={sec(0, fps)} durationInFrames={sec(2, fps)}>
        <Scene1 scale={scale} width={layoutWidth} height={layoutHeight} />
      </Sequence>

      {/* Caption 1 — 0s–2s (tail), "In your messages" */}
      <Sequence
        from={sec(0, fps)}
        durationInFrames={sec(2 + xfade, fps)}
      >
        <Caption
          text="In your messages"
          scale={scale}
          width={layoutWidth}
          height={layoutHeight}
          fadeOutAtSec={2 - xfade}
          durationSec={2}
        />
      </Sequence>

      {/* Scene 2 — 2s–5s: hard-cuts in on identical chat-row geometry, so the
          input/button appear persistent across the boundary. No fade-out at
          the end, for the same reason at the Scene 3 boundary. */}
      <Sequence from={sec(2, fps)} durationInFrames={sec(3, fps)}>
        <Scene2 scale={scale} width={layoutWidth} height={layoutHeight} />
      </Sequence>

      {/* Caption 2 — overlapping crossfade with Caption 1 (text-only, no stacking issue) */}
      <Sequence
        from={sec(2 - xfade, fps)}
        durationInFrames={sec(3 + xfade * 2, fps)}
      >
        <Caption
          text="and DOES ANYTHING you tell it to do"
          emphasized="DOES ANYTHING"
          scale={scale}
          width={layoutWidth}
          height={layoutHeight}
          fadeOutAtSec={3 + xfade}
          durationSec={3 + xfade * 2}
        />
      </Sequence>

      {/* Scene 3 — starts at 5s. Extended to 13.5s to fit the IG
          tap-and-share flight animation + the two text replies that
          land after the image attachment. */}
      <Sequence from={sec(5, fps)} durationInFrames={sec(13.5, fps)}>
        <Scene3
          scale={scale}
          width={layoutWidth}
          height={layoutHeight}
        />
      </Sequence>

      {/* Caption 3 — overlaps with Caption 2 (text-only crossfade is fine).
          Holds for Scene 3's full duration. */}
      <Sequence
        from={sec(5 - xfade, fps)}
        durationInFrames={sec(13.5 + xfade, fps)}
      >
        <Caption
          text="schedule a date with my crush"
          scale={scale}
          width={layoutWidth}
          height={layoutHeight}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

/**
 * Vertical 9:16 composition. Renders the ad at the full canvas size — the
 * canvas IS the mobile frame, so no safe-area gridline is needed.
 */
export const MessagesAd: React.FC = () => {
  const { width, height } = useVideoConfig();
  return <MessagesAdContent layoutWidth={width} layoutHeight={height} />;
};

type MessagesAdHorizontalProps = {
  /** Show the 9:16 mobile-safe-area outline. Defaults to studio-only. */
  showSafeArea?: boolean;
};

/**
 * Horizontal 16:9 composition. Lays the ad out inside a centered 9:16
 * mobile-safe region (so the visuals match what mobile viewers will see),
 * pillarboxing white on either side. When `showSafeArea` is true, an outline
 * marks the mobile crop region.
 */
export const MessagesAdHorizontal: React.FC<MessagesAdHorizontalProps> = ({
  showSafeArea,
}) => {
  const { width, height } = useVideoConfig();

  // Inner safe area: 9:16 rectangle centered horizontally within the 16:9
  // canvas. height stays full; width is height * 9/16.
  const safeWidth = Math.round(height * (9 / 16));
  const safeHeight = height;
  const safeLeft = Math.round((width - safeWidth) / 2);

  // Default: only show the overlay in the studio, never in render output.
  const overlayVisible =
    showSafeArea ?? getRemotionEnvironment().isStudio;

  return (
    <AbsoluteFill style={{ background: BG_WHITE }}>
      <div
        style={{
          position: "absolute",
          left: safeLeft,
          top: 0,
          width: safeWidth,
          height: safeHeight,
        }}
      >
        <MessagesAdContent
          layoutWidth={safeWidth}
          layoutHeight={safeHeight}
        />
      </div>

      {overlayVisible && (
        <SafeAreaOverlay
          width={width}
          height={height}
          safeLeft={safeLeft}
          safeWidth={safeWidth}
          safeHeight={safeHeight}
        />
      )}
    </AbsoluteFill>
  );
};

const SafeAreaOverlay: React.FC<{
  width: number;
  height: number;
  safeLeft: number;
  safeWidth: number;
  safeHeight: number;
}> = ({ width, safeLeft, safeWidth, safeHeight }) => {
  const stroke = Math.max(2, Math.round(width / 960));
  const labelPad = Math.max(8, Math.round(width / 240));
  const labelSize = Math.max(12, Math.round(width / 96));

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Dim the pillarbox regions so the safe area pops */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: safeLeft,
          height: safeHeight,
          background: "rgba(0,0,0,0.18)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: safeLeft + safeWidth,
          top: 0,
          width: safeLeft,
          height: safeHeight,
          background: "rgba(0,0,0,0.18)",
        }}
      />

      {/* Safe-area outline */}
      <div
        style={{
          position: "absolute",
          left: safeLeft,
          top: 0,
          width: safeWidth,
          height: safeHeight,
          border: `${stroke}px dashed rgba(255, 60, 90, 0.9)`,
          boxSizing: "border-box",
        }}
      />

      {/* Label */}
      <div
        style={{
          position: "absolute",
          left: safeLeft + labelPad,
          top: labelPad,
          padding: `${labelPad / 2}px ${labelPad}px`,
          background: "rgba(255, 60, 90, 0.9)",
          color: "#FFFFFF",
          fontFamily: FONT_STACK,
          fontWeight: 700,
          fontSize: labelSize,
          borderRadius: labelPad / 2,
          letterSpacing: 0.5,
        }}
      >
        9:16 MOBILE SAFE AREA
      </div>
    </AbsoluteFill>
  );
};
