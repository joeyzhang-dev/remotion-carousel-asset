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

/**
 * Amazon-style product page background. Mirrors `InstagramProfile`'s
 * role — sits behind the chat as ambient context — but redesigned to
 * read as an e-commerce listing for the closing punchline ("bet,
 * order some protection"): top nav, big product image, title +
 * brand + rating, price, buy buttons, "frequently bought together"
 * row, and a couple of additional rows below the fold.
 *
 * Same scroll model as the IG profile: hold briefly, scroll down at
 * a comfortable pace, with a small finger-jitter wobble. No
 * interactive tap (this just sits as background).
 */
type AmazonProductProps = {
  driveFrame: number;
  fps: number;
  width: number;
  height: number;
  scale: number;
  /** Master opacity for the whole background (0..1). */
  opacity: number;
  /** Optional scale to apply to the Buy Now button (for the
   * "agent taps Buy Now" feedback animation). Defaults to 1. */
  buyButtonScale?: number;
};

const AmazonProduct: React.FC<AmazonProductProps> = ({
  driveFrame,
  fps,
  width,
  height,
  scale,
  opacity,
  buyButtonScale = 1,
}) => {
  // Layout dimensions
  const padX = 28 * scale;
  const navHeight = 110 * scale;
  // Big product image area — wide and tall, like the hero photo on
  // an Amazon product listing.
  const heroImageH = width * 0.95;
  const titleSectionH = 220 * scale;
  const ratingRowH = 60 * scale;
  const priceSectionH = 140 * scale;
  const buyButtonsH = 200 * scale;
  const fboRowH = 280 * scale; // "Frequently bought together"
  const detailsRowH = 220 * scale;
  const headerTotalH =
    navHeight +
    heroImageH +
    titleSectionH +
    ratingRowH +
    priceSectionH +
    buyButtonsH +
    fboRowH +
    detailsRowH;

  const totalContentH = headerTotalH + 400 * scale; // a bit extra so we have room to scroll
  const maxScroll = Math.max(0, totalContentH - height);

  // Scroll model — same shape as the IG profile but tuned slightly
  // shorter since this background is on screen for less time.
  const driveSec = driveFrame / fps;
  const t = {
    holdEnd: 0.5,
    flickEnd: 1.2,
    settleEnd: 1.6,
    cruiseEnd: 3.5,
  };
  let baseScroll: number;
  if (driveSec < t.holdEnd) {
    baseScroll = 0;
  } else if (driveSec < t.flickEnd) {
    baseScroll = interpolate(
      driveSec,
      [t.holdEnd, t.flickEnd],
      [0, maxScroll * 0.55],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      },
    );
  } else if (driveSec < t.settleEnd) {
    baseScroll = maxScroll * 0.55;
  } else {
    baseScroll = interpolate(
      driveSec,
      [t.settleEnd, t.cruiseEnd],
      [maxScroll * 0.55, maxScroll],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.cubic),
      },
    );
  }
  // Wobble.
  const wobbleAmp = 4 * scale;
  const wobbleHz = 2.5;
  const wobbleEnabled = driveSec > t.holdEnd ? 1 : 0;
  const wobble =
    wobbleEnabled *
    wobbleAmp *
    Math.sin(2 * Math.PI * wobbleHz * (driveSec - t.holdEnd));
  const scrollPx = Math.min(maxScroll, Math.max(0, baseScroll + wobble));
  const pageY = -scrollPx;

  // Amazon's signature warm-yellow buy button + dark navy nav.
  const AMAZON_NAV = "#131A22";
  const AMAZON_YELLOW = "#FFD814";
  const AMAZON_ORANGE = "#FFA41C";
  const AMAZON_LINK = "#007185";
  const AMAZON_BG = "#FFFFFF";

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
        filter: `blur(${3 * scale}px) brightness(0.94) saturate(0.92)`,
        pointerEvents: "none",
        background: AMAZON_BG,
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
        {/* ── Nav bar (back + search + cart) ───────────────────── */}
        <div
          style={{
            height: navHeight,
            background: AMAZON_NAV,
            display: "flex",
            alignItems: "center",
            paddingLeft: padX,
            paddingRight: padX,
            gap: 14 * scale,
          }}
        >
          {/* back chevron */}
          <div
            style={{
              fontFamily: FONT_STACK,
              fontSize: 36 * scale,
              color: "#fff",
              fontWeight: 300,
            }}
          >
            ‹
          </div>
          {/* search bar */}
          <div
            style={{
              flex: 1,
              height: 56 * scale,
              borderRadius: 8 * scale,
              background: "#fff",
              display: "flex",
              alignItems: "center",
              paddingLeft: 14 * scale,
              fontFamily: FONT_STACK,
              fontSize: 22 * scale,
              color: "#888",
            }}
          >
            search amazon
          </div>
          {/* cart icon placeholder */}
          <div
            style={{
              width: 38 * scale,
              height: 38 * scale,
              borderRadius: 6 * scale,
              background: "rgba(255,255,255,0.85)",
            }}
          />
        </div>

        {/* ── Hero product image ───────────────────────────────── */}
        <div
          style={{
            width,
            height: heroImageH,
            background: "#F0F0EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Product hero image */}
          <Img
            src={staticFile("trojan-magnum.jpg")}
            style={{
              width: heroImageH * 0.85,
              height: heroImageH * 0.85,
              objectFit: "contain",
            }}
          />
        </div>

        {/* ── Title + brand ───────────────────────────────────── */}
        <div
          style={{
            paddingLeft: padX,
            paddingRight: padX,
            paddingTop: 18 * scale,
            paddingBottom: 18 * scale,
          }}
        >
          <div
            style={{
              fontFamily: FONT_STACK,
              fontSize: 22 * scale,
              color: AMAZON_LINK,
              marginBottom: 8 * scale,
            }}
          >
            Visit the Trojan Store
          </div>
          <div
            style={{
              fontFamily: FONT_STACK,
              fontSize: 28 * scale,
              fontWeight: 500,
              color: "#0F1111",
              lineHeight: 1.25,
            }}
          >
            Trojan Magnum Lubricated Latex Condoms — 12 Count
          </div>
        </div>

        {/* ── Rating row (stars + count) ──────────────────────── */}
        <div
          style={{
            paddingLeft: padX,
            paddingRight: padX,
            height: ratingRowH,
            display: "flex",
            alignItems: "center",
            gap: 12 * scale,
            borderBottom: `${1 * scale}px solid #E7E7E7`,
          }}
        >
          {/* 5 stars */}
          <div style={{ display: "flex", gap: 2 * scale }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  width: 24 * scale,
                  height: 24 * scale,
                  background: AMAZON_ORANGE,
                  clipPath:
                    "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
                }}
              />
            ))}
          </div>
          <div
            style={{
              fontFamily: FONT_STACK,
              fontSize: 20 * scale,
              color: AMAZON_LINK,
            }}
          >
            8,427 ratings
          </div>
        </div>

        {/* ── Price section ───────────────────────────────────── */}
        <div
          style={{
            paddingLeft: padX,
            paddingRight: padX,
            paddingTop: 16 * scale,
            paddingBottom: 16 * scale,
          }}
        >
          <div
            style={{
              fontFamily: FONT_STACK,
              fontSize: 22 * scale,
              color: "#565959",
            }}
          >
            Price:{" "}
            <span style={{ textDecoration: "line-through" }}>$24.99</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8 * scale,
              marginTop: 4 * scale,
            }}
          >
            <span
              style={{
                fontFamily: FONT_STACK,
                fontSize: 18 * scale,
                color: "#B12704",
              }}
            >
              $
            </span>
            <span
              style={{
                fontFamily: FONT_STACK,
                fontSize: 48 * scale,
                fontWeight: 400,
                color: "#B12704",
                lineHeight: 1,
              }}
            >
              17
            </span>
            <span
              style={{
                fontFamily: FONT_STACK,
                fontSize: 22 * scale,
                color: "#B12704",
              }}
            >
              .49
            </span>
            <span
              style={{
                fontFamily: FONT_STACK,
                fontSize: 18 * scale,
                color: "#565959",
                marginLeft: 8 * scale,
              }}
            >
              FREE delivery
            </span>
          </div>
        </div>

        {/* ── Buy buttons ─────────────────────────────────────── */}
        <div
          style={{
            paddingLeft: padX,
            paddingRight: padX,
            display: "flex",
            flexDirection: "column",
            gap: 10 * scale,
          }}
        >
          <div
            style={{
              height: 70 * scale,
              borderRadius: 999,
              background: AMAZON_YELLOW,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_STACK,
              fontSize: 22 * scale,
              fontWeight: 500,
              color: "#0F1111",
              border: `${1 * scale}px solid #FCD200`,
            }}
          >
            Add to Cart
          </div>
          <div
            style={{
              height: 70 * scale,
              borderRadius: 999,
              background: AMAZON_ORANGE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_STACK,
              fontSize: 22 * scale,
              fontWeight: 500,
              color: "#0F1111",
              border: `${1 * scale}px solid #FF8F00`,
              transform: `scale(${buyButtonScale})`,
              transformOrigin: "center",
            }}
          >
            Buy Now
          </div>
        </div>

        {/* ── Frequently bought together ──────────────────────── */}
        <div
          style={{
            marginTop: 24 * scale,
            paddingLeft: padX,
            paddingRight: padX,
            paddingTop: 16 * scale,
            paddingBottom: 16 * scale,
            borderTop: `${1 * scale}px solid #E7E7E7`,
            height: fboRowH,
          }}
        >
          <div
            style={{
              fontFamily: FONT_STACK,
              fontSize: 24 * scale,
              fontWeight: 700,
              color: "#0F1111",
              marginBottom: 14 * scale,
            }}
          >
            Frequently bought together
          </div>
          <div style={{ display: "flex", gap: 14 * scale, alignItems: "center" }}>
            {[0, 1, 2].map((i) => (
              <React.Fragment key={i}>
                <div
                  style={{
                    width: 130 * scale,
                    height: 130 * scale,
                    background: ["#D4A04F", "#C8B6A6", "#A8C0BE"][i],
                    borderRadius: 6 * scale,
                  }}
                />
                {i < 2 && (
                  <div
                    style={{
                      fontFamily: FONT_STACK,
                      fontSize: 36 * scale,
                      color: "#565959",
                      fontWeight: 300,
                    }}
                  >
                    +
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── Product details placeholder ─────────────────────── */}
        <div
          style={{
            paddingLeft: padX,
            paddingRight: padX,
            paddingTop: 18 * scale,
            paddingBottom: 18 * scale,
            borderTop: `${1 * scale}px solid #E7E7E7`,
            height: detailsRowH,
          }}
        >
          <div
            style={{
              fontFamily: FONT_STACK,
              fontSize: 24 * scale,
              fontWeight: 700,
              color: "#0F1111",
              marginBottom: 14 * scale,
            }}
          >
            Product details
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: width * (0.5 + Math.random() * 0.3),
                height: 14 * scale,
                background: "#E0E0E0",
                borderRadius: 4 * scale,
                marginBottom: 10 * scale,
                opacity: 0.7,
              }}
            />
          ))}
        </div>

        {/* ── Ratings histogram (a fake "customer reviews") ─── */}
        <div
          style={{
            paddingLeft: padX,
            paddingRight: padX,
            paddingTop: 18 * scale,
            paddingBottom: 18 * scale,
            borderTop: `${1 * scale}px solid #E7E7E7`,
          }}
        >
          <div
            style={{
              fontFamily: FONT_STACK,
              fontSize: 24 * scale,
              fontWeight: 700,
              color: "#0F1111",
              marginBottom: 14 * scale,
            }}
          >
            Customer reviews
          </div>
          {[5, 4, 3, 2, 1].map((star, i) => (
            <div
              key={star}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12 * scale,
                marginBottom: 8 * scale,
              }}
            >
              <div
                style={{
                  fontFamily: FONT_STACK,
                  fontSize: 20 * scale,
                  color: AMAZON_LINK,
                }}
              >
                {star} star
              </div>
              <div
                style={{
                  flex: 1,
                  height: 22 * scale,
                  background: "#F0F0F0",
                  borderRadius: 4 * scale,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${[68, 22, 6, 2, 2][i]}%`,
                    background: AMAZON_ORANGE,
                  }}
                />
              </div>
              <div
                style={{
                  fontFamily: FONT_STACK,
                  fontSize: 20 * scale,
                  color: "#0F1111",
                  width: 50 * scale,
                  textAlign: "right",
                }}
              >
                {[68, 22, 6, 2, 2][i]}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Google-Flights-style search results page background. Mirrors the
 * AmazonProduct component's role — sits behind the chat as ambient
 * context — but redesigned for a flight booking flow. Includes a
 * tap-pulse on a flight result card and a "Booking confirmed"
 * overlay that flashes briefly after the tap, before the page
 * exits.
 */
type FlightSearchProps = {
  driveFrame: number;
  fps: number;
  width: number;
  height: number;
  scale: number;
  /** Master opacity for the whole background (0..1). */
  opacity: number;
  /** Optional scale to apply to the tapped flight result card. */
  cardTapScale?: number;
  /** Index of the card that's been tapped — that card stays scaled
   * up + highlighted after the tap. -1 = no card tapped yet. */
  tappedCardIndex?: number;
  /** When > 0, freezes the scroll at the position it had at the
   * given driveSec value. Used so the page stops scrolling when a
   * card is tapped (the tapped card stays in view). */
  scrollFreezeAtSec?: number;
  /** Opacity for the "Booking confirmed" overlay (0..1). */
  bookingConfirmOpacity?: number;
};

const FlightSearch: React.FC<FlightSearchProps> = ({
  driveFrame,
  fps,
  width,
  height,
  scale,
  opacity,
  cardTapScale = 1,
  tappedCardIndex = -1,
  scrollFreezeAtSec,
  bookingConfirmOpacity = 0,
}) => {
  // Mobile-scaled layout: bigger fonts, more vertical breathing
  // room. Cards stack vertically (no desktop-style multi-column row)
  // so each one reads as a tappable list item rather than a table
  // row.
  const padX = 28 * scale;
  const navHeight = 100 * scale;
  const searchRowH = 160 * scale;
  const filterChipsH = 100 * scale;
  const tabsH = 110 * scale;
  const sectionHeaderH = 90 * scale;
  const flightCardH = 200 * scale;
  const flightCardGap = 12 * scale;
  const headerTotalH =
    navHeight + searchRowH + filterChipsH + tabsH + sectionHeaderH;
  const totalContentH = headerTotalH + flightCardH * 12 + 800 * scale;
  const maxScroll = Math.max(0, totalContentH - height);

  // Scroll: same shape as Amazon — slow scan, then settle. Once
  // `scrollFreezeAtSec` is reached, the scroll clamps at its
  // position from that moment forward (used after a card is tapped
  // so the focus card stays in view).
  const rawDriveSec = driveFrame / fps;
  const driveSec =
    scrollFreezeAtSec != null && rawDriveSec > scrollFreezeAtSec
      ? scrollFreezeAtSec
      : rawDriveSec;
  const t = {
    holdEnd: 0.4,
    flickEnd: 1.1,
    settleEnd: 1.5,
    cruiseEnd: 3.0,
  };
  let baseScroll: number;
  if (driveSec < t.holdEnd) {
    baseScroll = 0;
  } else if (driveSec < t.flickEnd) {
    baseScroll = interpolate(
      driveSec,
      [t.holdEnd, t.flickEnd],
      [0, maxScroll * 0.45],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      },
    );
  } else if (driveSec < t.settleEnd) {
    baseScroll = maxScroll * 0.45;
  } else {
    baseScroll = interpolate(
      driveSec,
      [t.settleEnd, t.cruiseEnd],
      [maxScroll * 0.45, maxScroll * 0.7],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.cubic),
      },
    );
  }
  const wobbleAmp = 4 * scale;
  const wobbleHz = 2.5;
  const wobbleEnabled = driveSec > t.holdEnd ? 1 : 0;
  const wobble =
    wobbleEnabled *
    wobbleAmp *
    Math.sin(2 * Math.PI * wobbleHz * (driveSec - t.holdEnd));
  const scrollPx = Math.min(maxScroll, Math.max(0, baseScroll + wobble));
  const pageY = -scrollPx;

  // Google blue + signature greys.
  const G_BLUE = "#1A73E8";
  const G_GREEN = "#188038";
  const G_TEXT = "#202124";
  const G_LIGHT = "#5F6368";
  const G_BORDER = "#DADCE0";
  const G_BG = "#FFFFFF";

  type FlightCard = {
    airline: string;
    color: string;
    times: string;
    duration: string;
    stops: string;
    co2: string;
    co2note: string;
    co2color: string;
    price: string;
  };
  const flightCards: FlightCard[] = [
    {
      airline: "American",
      color: "#C8102E",
      times: "10:15 PM – 6:59 AM",
      duration: "5 hr 44 min",
      stops: "Nonstop",
      co2: "573 kg CO2e",
      co2note: "+65% emissions",
      co2color: "#C0392B",
      price: "$568",
    },
    {
      airline: "Alaska",
      color: "#005DAA",
      times: "11:11 PM – 7:59 AM",
      duration: "5 hr 48 min",
      stops: "Nonstop",
      co2: "311 kg CO2e",
      co2note: "-10% emissions",
      co2color: G_GREEN,
      price: "$593",
    },
    {
      airline: "JetBlue",
      color: "#003876",
      times: "2:45 PM – 11:38 PM",
      duration: "5 hr 53 min",
      stops: "Nonstop",
      co2: "415 kg CO2e",
      co2note: "+20% emissions",
      co2color: "#C0392B",
      price: "$677",
    },
    {
      airline: "Delta",
      color: "#003366",
      times: "12:47 PM – 9:30 PM",
      duration: "5 hr 43 min",
      stops: "Nonstop",
      co2: "573 kg CO2e",
      co2note: "+65% emissions",
      co2color: "#C0392B",
      price: "$568",
    },
    {
      airline: "United",
      color: "#005DAA",
      times: "6:20 AM – 2:55 PM",
      duration: "5 hr 35 min",
      stops: "Nonstop",
      co2: "402 kg CO2e",
      co2note: "+15% emissions",
      co2color: "#C0392B",
      price: "$612",
    },
    {
      airline: "Southwest",
      color: "#304CB2",
      times: "9:30 AM – 8:25 PM",
      duration: "8 hr 55 min",
      stops: "1 stop · DEN",
      co2: "498 kg CO2e",
      co2note: "+44% emissions",
      co2color: "#C0392B",
      price: "$402",
    },
    {
      airline: "Spirit",
      color: "#FFE114",
      times: "5:55 AM – 5:15 PM",
      duration: "9 hr 20 min",
      stops: "1 stop · LAS",
      co2: "385 kg CO2e",
      co2note: "+11% emissions",
      co2color: "#C0392B",
      price: "$348",
    },
    {
      airline: "Frontier",
      color: "#00A551",
      times: "7:14 PM – 8:30 AM",
      duration: "10 hr 16 min",
      stops: "1 stop · DFW",
      co2: "412 kg CO2e",
      co2note: "+19% emissions",
      co2color: "#C0392B",
      price: "$362",
    },
    {
      airline: "American",
      color: "#C8102E",
      times: "8:45 AM – 5:11 PM",
      duration: "5 hr 26 min",
      stops: "Nonstop",
      co2: "560 kg CO2e",
      co2note: "+62% emissions",
      co2color: "#C0392B",
      price: "$598",
    },
    {
      airline: "JetBlue",
      color: "#003876",
      times: "11:55 PM – 8:42 AM",
      duration: "5 hr 47 min",
      stops: "Nonstop",
      co2: "418 kg CO2e",
      co2note: "+21% emissions",
      co2color: "#C0392B",
      price: "$641",
    },
    {
      airline: "Alaska",
      color: "#005DAA",
      times: "3:30 PM – 11:58 PM",
      duration: "5 hr 28 min",
      stops: "Nonstop",
      co2: "298 kg CO2e",
      co2note: "-13% emissions",
      co2color: G_GREEN,
      price: "$615",
    },
    {
      airline: "Delta",
      color: "#003366",
      times: "5:05 PM – 1:45 AM",
      duration: "5 hr 40 min",
      stops: "Nonstop",
      co2: "569 kg CO2e",
      co2note: "+64% emissions",
      co2color: "#C0392B",
      price: "$579",
    },
  ];

  // Tap target — driven by prop (defaults to -1 = no tap). The
  // parent picks an index that's mid-screen at tap time so the
  // expanded card stays visible.
  const TAPPED_CARD_INDEX = tappedCardIndex;

  const renderFilterChip = (label: string, active = false) => (
    <div
      key={label}
      style={{
        height: 64 * scale,
        paddingLeft: 22 * scale,
        paddingRight: 22 * scale,
        borderRadius: 999,
        background: active ? "#E8F0FE" : G_BG,
        border: `${1.5 * scale}px solid ${active ? G_BLUE : G_BORDER}`,
        display: "flex",
        alignItems: "center",
        fontFamily: FONT_STACK,
        fontSize: 24 * scale,
        color: active ? G_BLUE : G_TEXT,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );

  const renderFlightCard = (card: FlightCard, idx: number) => {
    const isTapped = idx === TAPPED_CARD_INDEX;
    // After the tap pulse settles (cardTapScale returns near 1) AND
    // the scroll is frozen, treat the card as "selected" and keep
    // it highlighted with a blue outline + larger shadow so it
    // visibly stands out from the un-tapped rows.
    const isSelected = isTapped && scrollFreezeAtSec != null;
    return (
      <div
        key={idx}
        style={{
          height: flightCardH,
          marginBottom: flightCardGap,
          paddingLeft: padX,
          paddingRight: padX,
          paddingTop: 22 * scale,
          paddingBottom: 22 * scale,
          background: G_BG,
          borderTop: isSelected ? "none" : `${1 * scale}px solid ${G_BORDER}`,
          border: isSelected
            ? `${3 * scale}px solid ${G_BLUE}`
            : undefined,
          borderRadius: isSelected ? 14 * scale : 0,
          marginLeft: isSelected ? padX * 0.5 : 0,
          marginRight: isSelected ? padX * 0.5 : 0,
          boxShadow: isSelected
            ? `0 ${8 * scale}px ${28 * scale}px rgba(26, 115, 232, 0.25)`
            : undefined,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 12 * scale,
          transform: isTapped ? `scale(${cardTapScale})` : undefined,
          transformOrigin: "center",
        }}
      >
        {/* Top row: times (big) + price (right-aligned, big green) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16 * scale,
          }}
        >
          <div
            style={{
              fontFamily: FONT_STACK,
              fontSize: 30 * scale,
              color: G_TEXT,
              fontWeight: 600,
              letterSpacing: -0.3 * scale,
            }}
          >
            {card.times}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 2 * scale,
            }}
          >
            <div
              style={{
                fontFamily: FONT_STACK,
                fontSize: 32 * scale,
                color: G_GREEN,
                fontWeight: 600,
                letterSpacing: -0.5 * scale,
              }}
            >
              {card.price}
            </div>
            <div
              style={{
                fontFamily: FONT_STACK,
                fontSize: 16 * scale,
                color: G_LIGHT,
              }}
            >
              round trip
            </div>
          </div>
        </div>
        {/* Bottom row: logo + airline / duration / stops + CO2 note */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14 * scale,
          }}
        >
          <div
            style={{
              width: 36 * scale,
              height: 36 * scale,
              borderRadius: "50%",
              background: card.color,
              flexShrink: 0,
            }}
          />
          <div
            style={{
              flex: 1,
              fontFamily: FONT_STACK,
              fontSize: 18 * scale,
              color: G_LIGHT,
              display: "flex",
              alignItems: "center",
              gap: 8 * scale,
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: G_TEXT, fontWeight: 500 }}>
              {card.airline}
            </span>
            <span style={{ color: G_BORDER }}>·</span>
            <span>{card.duration}</span>
            <span style={{ color: G_BORDER }}>·</span>
            <span>{card.stops}</span>
            <span style={{ color: G_BORDER }}>·</span>
            <span style={{ color: card.co2color }}>{card.co2note}</span>
          </div>
        </div>
      </div>
    );
  };

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
        filter: `blur(${3 * scale}px) brightness(0.94) saturate(0.92)`,
        pointerEvents: "none",
        background: G_BG,
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
        {/* ── Top status row (round trip · 1 · economy) ───────── */}
        <div
          style={{
            height: navHeight,
            paddingLeft: padX,
            paddingRight: padX,
            display: "flex",
            alignItems: "center",
            gap: 18 * scale,
            fontFamily: FONT_STACK,
            fontSize: 24 * scale,
            color: G_TEXT,
          }}
        >
          <div>⇄ Round trip ▾</div>
          <div>👤 1 ▾</div>
          <div>Economy ▾</div>
        </div>

        {/* ── Search row: cities + dates (stacked vertically for
              mobile-friendly readability) ─────────────────────── */}
        <div
          style={{
            paddingLeft: padX,
            paddingRight: padX,
            paddingTop: 8 * scale,
            paddingBottom: 16 * scale,
            display: "flex",
            flexDirection: "column",
            gap: 10 * scale,
          }}
        >
          {/* Cities row */}
          <div
            style={{
              height: 70 * scale,
              borderRadius: 12 * scale,
              border: `${1.5 * scale}px solid ${G_BORDER}`,
              display: "flex",
              alignItems: "center",
              paddingLeft: 22 * scale,
              paddingRight: 22 * scale,
              gap: 16 * scale,
              fontFamily: FONT_STACK,
              fontSize: 26 * scale,
              color: G_TEXT,
              fontWeight: 500,
            }}
          >
            <span>○ San Francisco</span>
            <span style={{ color: G_LIGHT, fontSize: 22 * scale }}>⇄</span>
            <span>New York</span>
          </div>
          {/* Dates row */}
          <div
            style={{
              height: 70 * scale,
              borderRadius: 12 * scale,
              border: `${1.5 * scale}px solid ${G_BORDER}`,
              display: "flex",
              alignItems: "center",
              paddingLeft: 22 * scale,
              paddingRight: 22 * scale,
              gap: 16 * scale,
              fontFamily: FONT_STACK,
              fontSize: 24 * scale,
              color: G_TEXT,
            }}
          >
            <span>📅 Fri, May 8</span>
            <span style={{ color: G_LIGHT }}>—</span>
            <span>Fri, May 15</span>
          </div>
        </div>

        {/* ── Filter chips row ─────────────────────────────────── */}
        <div
          style={{
            height: filterChipsH,
            paddingLeft: padX,
            paddingRight: padX,
            display: "flex",
            gap: 12 * scale,
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          {renderFilterChip("⇌ All filters", true)}
          {renderFilterChip("Stops")}
          {renderFilterChip("Airlines")}
          {renderFilterChip("Bags")}
          {renderFilterChip("Price")}
          {renderFilterChip("Times")}
        </div>

        {/* ── Best / Cheapest tabs ────────────────────────────── */}
        <div
          style={{
            height: tabsH,
            paddingLeft: padX,
            paddingRight: padX,
            paddingTop: 12 * scale,
            display: "flex",
            gap: 10 * scale,
          }}
        >
          <div
            style={{
              flex: 1,
              height: tabsH - 24 * scale,
              borderRadius: 12 * scale,
              border: `${2.5 * scale}px solid ${G_BLUE}`,
              background: "#E8F0FE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_STACK,
              fontSize: 26 * scale,
              fontWeight: 600,
              color: G_BLUE,
            }}
          >
            Best
          </div>
          <div
            style={{
              flex: 1,
              height: tabsH - 24 * scale,
              borderRadius: 12 * scale,
              border: `${1.5 * scale}px solid ${G_BORDER}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_STACK,
              fontSize: 24 * scale,
              color: G_TEXT,
            }}
          >
            Cheapest · from $348
          </div>
        </div>

        {/* ── "Top departing flights" header ──────────────────── */}
        <div
          style={{
            height: sectionHeaderH,
            paddingLeft: padX,
            paddingRight: padX,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: FONT_STACK,
          }}
        >
          <div style={{ fontSize: 28 * scale, fontWeight: 700, color: G_TEXT }}>
            Top departing flights
          </div>
          <div style={{ fontSize: 20 * scale, color: G_BLUE }}>
            Sort ⇅
          </div>
        </div>

        {/* ── Flight result cards (top 6) ─────────────────────── */}
        {flightCards.slice(0, 6).map((card, idx) => renderFlightCard(card, idx))}

        {/* ── Tip strip ────────────────────────────────────────── */}
        <div
          style={{
            margin: padX,
            padding: 22 * scale,
            background: "#E8F0FE",
            borderRadius: 12 * scale,
            display: "flex",
            alignItems: "center",
            gap: 18 * scale,
            fontFamily: FONT_STACK,
            fontSize: 22 * scale,
            color: G_TEXT,
          }}
        >
          <div style={{ flex: 1 }}>
            <div>Cheapest time is usually 1–4 months before takeoff</div>
          </div>
          <div style={{ width: 1.5 * scale, height: 50 * scale, background: G_BORDER }} />
          <div style={{ flex: 1 }}>
            <div>Prices are currently <span style={{ color: "#C0392B", fontWeight: 600 }}>high</span></div>
          </div>
        </div>

        {/* ── "Other departing flights" header ────────────────── */}
        <div
          style={{
            height: sectionHeaderH,
            paddingLeft: padX,
            paddingRight: padX,
            display: "flex",
            alignItems: "center",
            fontFamily: FONT_STACK,
            fontSize: 28 * scale,
            fontWeight: 700,
            color: G_TEXT,
          }}
        >
          Other departing flights
        </div>

        {/* ── More flight result cards (rest of the list) ───── */}
        {flightCards.slice(6).map((card, idx) => renderFlightCard(card, idx + 6))}
      </div>

      {/* ── "Flight Booked" confirmation card. Takes over much of
            the canvas as a substantial confirmation panel — like an
            Apple Pay or airline-app confirmation screen. Rendered
            absolutely outside the scrolling container so it stays
            centered on screen. ─────────────────────────────────── */}
      {bookingConfirmOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width,
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: bookingConfirmOpacity,
            pointerEvents: "none",
            background: "rgba(0,0,0,0.35)",
          }}
        >
          <div
            style={{
              width: width * 0.84,
              borderRadius: 18 * scale,
              background: "#FFFFFF",
              fontFamily: FONT_STACK,
              boxShadow: `0 ${20 * scale}px ${60 * scale}px rgba(0,0,0,0.35)`,
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Alaska header strip */}
            <div
              style={{
                background:
                  "linear-gradient(135deg, #0060AB 0%, #003E73 100%)",
                padding: `${22 * scale}px ${28 * scale}px`,
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  fontSize: 28 * scale,
                  fontWeight: 700,
                  letterSpacing: 0.5 * scale,
                }}
              >
                Alaska
              </div>
              <div style={{ fontSize: 22 * scale, fontWeight: 500, opacity: 0.9 }}>
                AS 1281 · Boarding pass
              </div>
            </div>
            {/* Itinerary block */}
            <div
              style={{
                padding: `${28 * scale}px`,
                paddingTop: 32 * scale,
                paddingBottom: 24 * scale,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8 * scale,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                  <div
                    style={{
                      fontSize: 56 * scale,
                      fontWeight: 700,
                      color: "#202124",
                      letterSpacing: -1 * scale,
                      lineHeight: 1,
                    }}
                  >
                    SFO
                  </div>
                  <div style={{ fontSize: 20 * scale, color: "#5F6368", marginTop: 6 * scale }}>
                    Fri · 11:11 PM
                  </div>
                </div>
                {/* Flight path with plane */}
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    paddingLeft: 12 * scale,
                    paddingRight: 12 * scale,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 8 * scale,
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: 0,
                        borderTop: `${2 * scale}px dashed #DADCE0`,
                      }}
                    />
                    <svg width={28 * scale} height={28 * scale} viewBox="0 0 24 24" fill="none">
                      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="#1A73E8" />
                    </svg>
                    <div
                      style={{
                        flex: 1,
                        height: 0,
                        borderTop: `${2 * scale}px dashed #DADCE0`,
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 16 * scale, color: "#5F6368", marginTop: 6 * scale }}>
                    5h 48m · Nonstop
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <div
                    style={{
                      fontSize: 56 * scale,
                      fontWeight: 700,
                      color: "#202124",
                      letterSpacing: -1 * scale,
                      lineHeight: 1,
                    }}
                  >
                    JFK
                  </div>
                  <div style={{ fontSize: 20 * scale, color: "#5F6368", marginTop: 6 * scale }}>
                    Sat · 7:59 AM
                  </div>
                </div>
              </div>
              {/* Passenger / Gate / Seat / Group strip */}
              <div
                style={{
                  marginTop: 22 * scale,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr 1fr",
                  gap: 12 * scale,
                  paddingTop: 18 * scale,
                  borderTop: `${1 * scale}px solid #E8EAED`,
                }}
              >
                {[
                  { label: "PASSENGER", value: "Alex R." },
                  { label: "GATE", value: "B14" },
                  { label: "SEAT", value: "7A" },
                  { label: "GROUP", value: "2" },
                ].map((cell) => (
                  <div key={cell.label} style={{ display: "flex", flexDirection: "column", gap: 4 * scale }}>
                    <div
                      style={{
                        fontSize: 13 * scale,
                        color: "#5F6368",
                        letterSpacing: 0.5 * scale,
                        fontWeight: 600,
                      }}
                    >
                      {cell.label}
                    </div>
                    <div
                      style={{
                        fontSize: 24 * scale,
                        fontWeight: 700,
                        color: "#202124",
                      }}
                    >
                      {cell.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Perforation row */}
            <div
              style={{
                position: "relative",
                height: 24 * scale,
              }}
            >
              {/* Left notch */}
              <div
                style={{
                  position: "absolute",
                  left: -12 * scale,
                  top: 0,
                  width: 24 * scale,
                  height: 24 * scale,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.35)",
                }}
              />
              {/* Right notch */}
              <div
                style={{
                  position: "absolute",
                  right: -12 * scale,
                  top: 0,
                  width: 24 * scale,
                  height: 24 * scale,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.35)",
                }}
              />
              {/* Dashed line */}
              <div
                style={{
                  position: "absolute",
                  left: 24 * scale,
                  right: 24 * scale,
                  top: 12 * scale,
                  height: 0,
                  borderTop: `${2 * scale}px dashed #DADCE0`,
                }}
              />
            </div>
            {/* Bottom half — QR + barcode */}
            <div
              style={{
                padding: `${24 * scale}px ${28 * scale}px`,
                display: "flex",
                alignItems: "center",
                gap: 22 * scale,
              }}
            >
              {/* QR code (8x8 grid) */}
              <div
                style={{
                  width: 130 * scale,
                  height: 130 * scale,
                  display: "grid",
                  gridTemplateColumns: "repeat(8, 1fr)",
                  gridTemplateRows: "repeat(8, 1fr)",
                  background: "#FFFFFF",
                  border: `${2 * scale}px solid #202124`,
                  padding: 4 * scale,
                  flexShrink: 0,
                }}
              >
                {[
                  1,1,1,0,1,1,1,0,
                  1,0,1,1,0,1,0,1,
                  1,0,1,0,1,0,1,1,
                  1,1,0,1,1,1,0,0,
                  0,1,1,0,1,0,1,1,
                  1,0,1,1,0,1,1,0,
                  0,1,0,1,1,0,0,1,
                  1,1,0,0,1,1,1,1,
                ].map((cell, i) => (
                  <div
                    key={i}
                    style={{
                      background: cell ? "#202124" : "#FFFFFF",
                    }}
                  />
                ))}
              </div>
              {/* Barcode + scan label */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    height: 80 * scale,
                    gap: 2 * scale,
                  }}
                >
                  {[3, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 1, 3, 1, 2, 4, 1, 1, 3, 2, 1, 2, 1, 3, 1].map((w, i) => (
                    <div
                      key={i}
                      style={{
                        width: w * scale,
                        background: "#202124",
                      }}
                    />
                  ))}
                </div>
                <div style={{ fontSize: 16 * scale, color: "#5F6368", marginTop: 8 * scale }}>
                  Scan at security · AX9F4Q-7K
                </div>
                <div
                  style={{
                    marginTop: 14 * scale,
                    padding: `${8 * scale}px ${14 * scale}px`,
                    borderRadius: 999,
                    background: "#E6F4EA",
                    color: "#188038",
                    fontSize: 16 * scale,
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6 * scale,
                  }}
                >
                  <span style={{ fontSize: 14 * scale }}>🌱</span>
                  Carbon offset included · 412 kg
                </div>
              </div>
            </div>
            {/* Total paid footer */}
            <div
              style={{
                background: "#E8F0FE",
                padding: `${20 * scale}px ${28 * scale}px`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 * scale }}>
                <div style={{ fontSize: 16 * scale, color: "#5F6368" }}>
                  Charged to ····4829
                </div>
                <div style={{ fontSize: 14 * scale, color: "#5F6368" }}>
                  via Google Pay
                </div>
              </div>
              <div style={{ fontSize: 36 * scale, fontWeight: 700, color: "#1A73E8", letterSpacing: -0.3 * scale }}>
                $1,186.00
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Apple Wallet-style mobile background. Used as the agent "pays off
 * a credit card" in the closing edit sequence. iOS app-open zoom +
 * scroll + tap on the Pay button + a "Payment Sent" confirmation
 * panel that mirrors the FlightSearch confirmation card style.
 */
type AppleWalletProps = {
  driveFrame: number;
  fps: number;
  width: number;
  height: number;
  scale: number;
  opacity: number;
  /** Tap-pulse on the Pay pill (1 = no pulse). */
  payButtonScale?: number;
  /** Opacity for the "Payment Sent" confirmation overlay. */
  paymentConfirmOpacity?: number;
};

const AppleWallet: React.FC<AppleWalletProps> = ({
  driveFrame,
  fps,
  width,
  height,
  scale,
  opacity,
  payButtonScale = 1,
  paymentConfirmOpacity = 0,
}) => {
  const padX = 28 * scale;
  const titleH = 110 * scale;
  const cardStackH = width * 0.62; // tall card stack
  const balanceH = 200 * scale;
  const payButtonH = 100 * scale;
  const txnRowH = 90 * scale;
  const totalContentH =
    titleH + cardStackH + balanceH + payButtonH + txnRowH * 6 + 200 * scale;
  const maxScroll = Math.max(0, totalContentH - height);

  const driveSec = driveFrame / fps;
  let baseScroll = 0;
  if (driveSec < 0.4) {
    baseScroll = 0;
  } else if (driveSec < 1.1) {
    baseScroll = interpolate(driveSec, [0.4, 1.1], [0, maxScroll * 0.5], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
  } else {
    baseScroll = maxScroll * 0.5;
  }
  const wobble =
    driveSec > 0.4
      ? 4 * scale * Math.sin(2 * Math.PI * 2.5 * (driveSec - 0.4))
      : 0;
  const scrollPx = Math.min(maxScroll, Math.max(0, baseScroll + wobble));
  const pageY = -scrollPx;

  const W_BG = "#FFFFFF";
  const W_TEXT = "#1C1C1E";
  const W_LIGHT = "#8E8E93";
  const W_BORDER = "#E5E5EA";
  const W_RED = "#FF3B30";

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
        filter: `blur(${3 * scale}px) brightness(0.94) saturate(0.92)`,
        pointerEvents: "none",
        background: W_BG,
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
        {/* Title */}
        <div
          style={{
            height: titleH,
            paddingLeft: padX,
            paddingRight: padX,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: FONT_STACK,
          }}
        >
          <div
            style={{
              fontSize: 44 * scale,
              fontWeight: 700,
              color: W_TEXT,
              letterSpacing: -0.5 * scale,
            }}
          >
            Wallet
          </div>
          <div
            style={{
              width: 44 * scale,
              height: 44 * scale,
              borderRadius: "50%",
              background: "#F2F2F7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28 * scale,
              color: W_LIGHT,
            }}
          >
            +
          </div>
        </div>
        {/* Card stack */}
        <div
          style={{
            paddingLeft: padX,
            paddingRight: padX,
            position: "relative",
            height: cardStackH,
          }}
        >
          {/* Bottom card (Apple Card, peeking) */}
          <div
            style={{
              position: "absolute",
              left: padX + 20 * scale,
              right: padX + 20 * scale,
              top: 16 * scale,
              height: cardStackH * 0.55,
              borderRadius: 22 * scale,
              background:
                "linear-gradient(135deg, #E8E8EC 0%, #C8C8CD 100%)",
              boxShadow: `0 ${8 * scale}px ${20 * scale}px rgba(0,0,0,0.12)`,
              padding: 22 * scale,
              fontFamily: FONT_STACK,
              color: W_TEXT,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontSize: 22 * scale, fontWeight: 600 }}>
              Apple Card
            </div>
            <div style={{ fontSize: 18 * scale, color: W_LIGHT }}>
              ···· 2841
            </div>
          </div>
          {/* Top card (Sapphire-ish, primary) */}
          <div
            style={{
              position: "absolute",
              left: padX,
              right: padX,
              top: cardStackH * 0.32,
              height: cardStackH * 0.62,
              borderRadius: 22 * scale,
              background:
                "linear-gradient(135deg, #0F1F3D 0%, #1A2F5C 60%, #2C4373 100%)",
              boxShadow: `0 ${10 * scale}px ${28 * scale}px rgba(0,0,0,0.25)`,
              padding: 22 * scale,
              fontFamily: FONT_STACK,
              color: "#fff",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div style={{ fontSize: 24 * scale, fontWeight: 600 }}>
                Chase Sapphire
              </div>
              <div
                style={{
                  fontSize: 24 * scale,
                  fontStyle: "italic",
                  fontWeight: 700,
                  letterSpacing: 1 * scale,
                }}
              >
                VISA
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 24 * scale,
                  letterSpacing: 4 * scale,
                  fontFamily: "monospace",
                }}
              >
                ···· ···· ···· 4829
              </div>
              <div
                style={{
                  fontSize: 16 * scale,
                  color: "rgba(255,255,255,0.7)",
                  marginTop: 8 * scale,
                }}
              >
                CARDHOLDER
              </div>
            </div>
          </div>
        </div>
        {/* Balance section */}
        <div
          style={{
            paddingLeft: padX,
            paddingRight: padX,
            paddingTop: 24 * scale,
            paddingBottom: 16 * scale,
            display: "flex",
            flexDirection: "column",
            gap: 8 * scale,
          }}
        >
          <div
            style={{
              fontSize: 20 * scale,
              color: W_LIGHT,
              fontFamily: FONT_STACK,
            }}
          >
            Current balance
          </div>
          <div
            style={{
              fontSize: 56 * scale,
              fontWeight: 700,
              color: W_RED,
              fontFamily: FONT_STACK,
              letterSpacing: -1 * scale,
            }}
          >
            $2,847.13
          </div>
          <div
            style={{
              fontSize: 18 * scale,
              color: W_LIGHT,
              fontFamily: FONT_STACK,
            }}
          >
            Statement balance · due May 22
          </div>
        </div>
        {/* Pay button */}
        <div
          style={{
            paddingLeft: padX,
            paddingRight: padX,
            paddingTop: 12 * scale,
            paddingBottom: 24 * scale,
          }}
        >
          <div
            style={{
              height: payButtonH,
              borderRadius: 999,
              background: "#000000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_STACK,
              fontSize: 28 * scale,
              fontWeight: 600,
              color: "#fff",
              transform: `scale(${payButtonScale})`,
              transformOrigin: "center",
              boxShadow: `0 ${4 * scale}px ${16 * scale}px rgba(0,0,0,0.2)`,
            }}
          >
            Pay $2,847.13
          </div>
        </div>
        {/* Recent transactions */}
        <div
          style={{
            paddingLeft: padX,
            paddingRight: padX,
            paddingTop: 24 * scale,
            paddingBottom: 12 * scale,
            borderTop: `${1 * scale}px solid ${W_BORDER}`,
          }}
        >
          <div
            style={{
              fontSize: 24 * scale,
              fontWeight: 700,
              color: W_TEXT,
              fontFamily: FONT_STACK,
              marginBottom: 16 * scale,
            }}
          >
            Recent transactions
          </div>
          {[
            { name: "Whole Foods", date: "May 7", amount: "−$42.18" },
            { name: "Uber", date: "May 6", amount: "−$14.50" },
            { name: "Spotify", date: "May 5", amount: "−$9.99" },
            { name: "Trader Joe's", date: "May 4", amount: "−$67.34" },
            { name: "Starbucks", date: "May 4", amount: "−$6.45" },
            { name: "Amazon", date: "May 3", amount: "−$129.00" },
          ].map((tx, i) => (
            <div
              key={i}
              style={{
                height: txnRowH,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: `${1 * scale}px solid ${W_BORDER}`,
                fontFamily: FONT_STACK,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4 * scale }}>
                <div style={{ fontSize: 22 * scale, color: W_TEXT, fontWeight: 500 }}>
                  {tx.name}
                </div>
                <div style={{ fontSize: 18 * scale, color: W_LIGHT }}>
                  {tx.date}
                </div>
              </div>
              <div style={{ fontSize: 22 * scale, color: W_TEXT }}>
                {tx.amount}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Apple Pay bottom-sheet — mirrors the actual iOS Apple Pay
          payment-confirmation that pops up from the bottom edge of
          the screen. Rounded TOP corners only, drag-handle bar, the
          card visual at the top with merchant info, big green ✓
          with "Done" in green, then a "Pay with Face ID / passcode"
          hint pill at the very bottom. */}
      {paymentConfirmOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width,
            height,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            opacity: paymentConfirmOpacity,
            pointerEvents: "none",
            background: "rgba(0,0,0,0.35)",
          }}
        >
          <div
            style={{
              width,
              borderTopLeftRadius: 36 * scale,
              borderTopRightRadius: 36 * scale,
              background: "#F2F2F7",
              fontFamily: FONT_STACK,
              boxShadow: `0 ${-12 * scale}px ${40 * scale}px rgba(0,0,0,0.25)`,
              overflow: "hidden",
              paddingBottom: 40 * scale,
            }}
          >
            {/* Drag handle */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                paddingTop: 12 * scale,
                paddingBottom: 22 * scale,
              }}
            >
              <div
                style={{
                  width: 50 * scale,
                  height: 6 * scale,
                  borderRadius: 999,
                  background: "#C7C7CC",
                }}
              />
            </div>
            {/* Top header strip — Cancel / Title / Done lookalike but
                we replace with the merchant identity row */}
            <div
              style={{
                paddingLeft: 28 * scale,
                paddingRight: 28 * scale,
                paddingBottom: 14 * scale,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8 * scale,
              }}
            >
              <div
                style={{
                  fontSize: 30 * scale,
                  fontWeight: 600,
                  color: "#000000",
                  letterSpacing: -0.3 * scale,
                }}
              >
                Apple Pay
              </div>
            </div>
            {/* Card row — Sapphire credit card visual on the left,
                merchant info on the right. This mirrors Apple Pay's
                actual sheet where the active card is shown horizontally. */}
            <div
              style={{
                margin: `${4 * scale}px ${20 * scale}px ${16 * scale}px`,
                padding: `${18 * scale}px ${20 * scale}px`,
                borderRadius: 18 * scale,
                background: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                gap: 18 * scale,
              }}
            >
              {/* Compact card thumbnail */}
              <div
                style={{
                  width: 90 * scale,
                  height: 58 * scale,
                  borderRadius: 8 * scale,
                  background:
                    "linear-gradient(135deg, #1F3A5F 0%, #0A1F3D 100%)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: `${6 * scale}px ${8 * scale}px`,
                  flexShrink: 0,
                  boxShadow: `0 ${2 * scale}px ${8 * scale}px rgba(0,0,0,0.15)`,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Sheen */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(115deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)",
                  }}
                />
                {/* Chip */}
                <div
                  style={{
                    width: 14 * scale,
                    height: 11 * scale,
                    borderRadius: 2 * scale,
                    background:
                      "linear-gradient(135deg, #C9A95C 0%, #8C7038 100%)",
                  }}
                />
                <div
                  style={{
                    fontSize: 9 * scale,
                    color: "#FFFFFF",
                    fontFamily: "monospace",
                    letterSpacing: 0.5 * scale,
                    fontWeight: 500,
                  }}
                >
                  ···· 4829
                </div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 * scale }}>
                <div style={{ fontSize: 20 * scale, fontWeight: 600, color: "#000000" }}>
                  Chase Sapphire
                </div>
                <div style={{ fontSize: 14 * scale, color: "#8E8E93" }}>
                  Visa Credit · 4829
                </div>
              </div>
              <div
                style={{
                  fontSize: 16 * scale,
                  color: "#007AFF",
                  fontWeight: 500,
                }}
              >
                ›
              </div>
            </div>
            {/* Pay TO row */}
            <div
              style={{
                margin: `0 ${20 * scale}px ${16 * scale}px`,
                padding: `${18 * scale}px ${20 * scale}px`,
                borderRadius: 18 * scale,
                background: "#FFFFFF",
                display: "flex",
                flexDirection: "column",
                gap: 14 * scale,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ fontSize: 18 * scale, color: "#8E8E93" }}>
                  Pay
                </div>
                <div style={{ fontSize: 18 * scale, color: "#000000", fontWeight: 500 }}>
                  Chase Statement
                </div>
              </div>
              <div
                style={{
                  height: 1 * scale,
                  background: "#E5E5EA",
                  marginLeft: -20 * scale,
                  marginRight: -20 * scale,
                }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ fontSize: 18 * scale, color: "#8E8E93" }}>
                  Total
                </div>
                <div
                  style={{
                    fontSize: 32 * scale,
                    color: "#000000",
                    fontWeight: 700,
                    letterSpacing: -0.3 * scale,
                  }}
                >
                  $2,847.13
                </div>
              </div>
            </div>
            {/* Big green DONE check moment */}
            <div
              style={{
                margin: `${8 * scale}px ${20 * scale}px ${20 * scale}px`,
                padding: `${28 * scale}px ${20 * scale}px`,
                borderRadius: 18 * scale,
                background: "#FFFFFF",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16 * scale,
              }}
            >
              {/* Animated-ring style green check (no actual animation
                  but the doubled stroke gives a "pulse just landed"
                  feel) */}
              <div
                style={{
                  width: 96 * scale,
                  height: 96 * scale,
                  borderRadius: "50%",
                  background: "#34C759",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: `0 ${4 * scale}px ${16 * scale}px rgba(52, 199, 89, 0.35), 0 0 0 ${8 * scale}px rgba(52, 199, 89, 0.12)`,
                }}
              >
                <svg width={56 * scale} height={56 * scale} viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 12 L10 18 L20 6"
                    stroke="#FFFFFF"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div
                style={{
                  fontSize: 36 * scale,
                  fontWeight: 700,
                  color: "#34C759",
                  letterSpacing: -0.3 * scale,
                }}
              >
                Done
              </div>
            </div>
            {/* Face ID hint pill at the very bottom */}
            <div
              style={{
                paddingLeft: 28 * scale,
                paddingRight: 28 * scale,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10 * scale,
                fontSize: 16 * scale,
                color: "#8E8E93",
              }}
            >
              {/* Face ID glyph */}
              <svg width={20 * scale} height={20 * scale} viewBox="0 0 24 24" fill="none">
                <path d="M4 8 V5 C4 4 5 3 6 3 H9" stroke="#8E8E93" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                <path d="M20 8 V5 C20 4 19 3 18 3 H15" stroke="#8E8E93" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                <path d="M4 16 V19 C4 20 5 21 6 21 H9" stroke="#8E8E93" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                <path d="M20 16 V19 C20 20 19 21 18 21 H15" stroke="#8E8E93" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                <circle cx="9" cy="11" r="0.8" fill="#8E8E93" />
                <circle cx="15" cy="11" r="0.8" fill="#8E8E93" />
                <path d="M9 16 Q12 18 15 16" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </svg>
              <span>Authenticated with Face ID</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Gmail-style inbox + open-email background. The agent "responds to
 * all emails" — the inbox shows a list, then a focused email detail
 * slides up over it, and the Reply All chip is tapped, triggering a
 * "Replied to 47 emails" confirmation card.
 */
type GmailInboxProps = {
  driveFrame: number;
  fps: number;
  width: number;
  height: number;
  scale: number;
  opacity: number;
  /** Tap-pulse on the Reply All chip. */
  replyAllScale?: number;
  /** Opacity for the "Replied" confirmation overlay. */
  replySentOpacity?: number;
};

const GmailInbox: React.FC<GmailInboxProps> = ({
  driveFrame,
  fps,
  width,
  height,
  scale,
  opacity,
  replyAllScale = 1,
}) => {
  // Mobile-native scale. The reference iPhone screenshots have ~22pt
  // sender, ~18pt subject, ~16pt snippet, ~44px avatars, and rows
  // ~120px tall — but rendered on a 390px-wide canvas. Our canvas
  // is 1080px wide (~2.77× the iPhone), so the on-canvas pixel
  // values need to scale up accordingly to keep the same visual
  // density as a real phone screen.
  const padX = 32 * scale;
  const navH = 110 * scale;
  const searchH = 100 * scale;
  const tabsH = 0; // Native Gmail iOS doesn't show category tabs by default
  const emailItemH = 230 * scale;
  // Inbox content spans behind the (eventually) visible email
  // detail card. Total content height set generous for scroll.
  const totalContentH =
    navH + searchH + tabsH + emailItemH * 21 + 200 * scale;
  const maxScroll = Math.max(0, totalContentH - height);

  const driveSec = driveFrame / fps;
  // Inbox scroll: hold briefly, then a small flick + settle.
  let baseScroll = 0;
  if (driveSec < 0.4) {
    baseScroll = 0;
  } else if (driveSec < 1.0) {
    baseScroll = interpolate(driveSec, [0.4, 1.0], [0, maxScroll * 0.35], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
  } else {
    baseScroll = maxScroll * 0.35;
  }
  const wobble =
    driveSec > 0.4
      ? 4 * scale * Math.sin(2 * Math.PI * 2.5 * (driveSec - 0.4))
      : 0;
  const scrollPx = Math.min(maxScroll, Math.max(0, baseScroll + wobble));
  const pageY = -scrollPx;

  // ── Speedup montage (rapid email-by-email replies) ────────────
  // After the email-detail card slides up, the agent rapid-fire
  // cycles through several emails — each one flashes with a
  // typewriter reply showing in a "Reply" preview box at the
  // bottom. Then it settles on a final email for the Reply All
  // tap. Targets ~6-8 emails per second (very fast / superhuman).
  type SpeedupEmail = {
    initial: string;
    color: string;
    name: string;
    senderEmail: string;
    subject: string;
    /** Greeting line, e.g. "Hi Joey," */
    greeting: string;
    /** Body paragraphs — rendered as separate blocks. */
    paragraphs: string[];
    /** Closing line, e.g. "Thanks," or "Best," */
    signoff: string;
    /** Signature block — name + title/company on subsequent lines. */
    signature: string[];
    reply: string;
  };
  const speedupEmails: SpeedupEmail[] = [
    {
      initial: "M",
      color: "#5F6368",
      name: "Marcus Chen",
      senderEmail: "marcus.chen@northwave.co",
      subject: "Q4 review deck — needs your input by EOD",
      greeting: "Hi Joey,",
      paragraphs: [
        "Hope you had a good weekend. Just looping back on the Q4 review deck — leadership wants to land it tomorrow morning, so I need your edits by end of day if at all possible.",
        "Specifically, slides 4 through 7 are stale. Can you swap in the latest revenue numbers from the November close (Sarah said she'd confirm by 3pm), and add a short paragraph on Q1 outlook? I'd suggest framing it around the three new enterprise accounts we closed last week, but use your judgment on the narrative.",
        "Also — if you have 15 minutes this afternoon, would love to jump on a quick call to align on the messaging before this goes to the board. Anytime between 2 and 5 works on my end.",
        "Let me know if you have questions. Appreciate the quick turnaround.",
      ],
      signoff: "Thanks,",
      signature: ["Marcus", "VP Strategy · Northwave"],
      reply:
        "On it — pushing the slide updates by 4pm and free at 2:30 for the call.",
    },
    {
      initial: "S",
      color: "#1A73E8",
      name: "Sarah Martinez",
      senderEmail: "smartinez@northwave.co",
      subject: "Re: expense reports — November totals",
      greeting: "Hey Joey,",
      paragraphs: [
        "Thanks for sending those over yesterday. I've been processing them this morning and everything looks clean except for two flagged items I want to confirm with you before I close out the month.",
        "First, the $1,847.22 from Oct 28 marked \"client dinner\" — there's no receipt attached. Can you forward whatever you have? Even a credit card screenshot would work for the file.",
        "Second, the November totals are coming in slightly under what we projected ($24,108 vs $25,500 forecast). Not a huge variance but I want to flag it before sending to finance. Are there any pending reimbursements you haven't submitted yet?",
        "Once those two are sorted I can close November on Friday.",
      ],
      signoff: "Best,",
      signature: ["Sarah", "Senior Accountant · Northwave"],
      reply:
        "Receipt forwarded; nothing else outstanding. Good to close November.",
    },
    {
      initial: "M",
      color: "#EA4335",
      name: "Mom",
      senderEmail: "lindahzhang@gmail.com",
      subject: "Sunday dinner — and your aunt's news!",
      greeting: "Hi sweetie,",
      paragraphs: [
        "Just checking — are you still coming for dinner this Sunday? I'm making the lasagna you like, plus garlic bread and that big salad with the candied walnuts your father always asks for. We'll eat around 6 if that works.",
        "Also, big news — your Aunt Carol got into the doctorate program at Stanford!! She found out yesterday and she's over the moon. I told her you'd want to congratulate her, so when you have a sec maybe shoot her a text. I know it would mean a lot.",
        "Oh, and dad finally got the leak in the basement fixed. He says hi and to tell you the Niners are looking better than they have in years. (His words, not mine.)",
        "Drive safe if you're coming — they're saying maybe rain Saturday.",
      ],
      signoff: "Love,",
      signature: ["Mom", "xoxo"],
      reply:
        "Yes, see you Sunday at 6! Will text Aunt Carol tonight ❤",
    },
    {
      initial: "G",
      color: "#1A73E8",
      name: "GitHub",
      senderEmail: "noreply@github.com",
      subject: "[acme/api] Pull request #2841 needs your review",
      greeting: "Hi @joey,",
      paragraphs: [
        "Ben Wallace (@ben-w) opened a pull request that requires review from your team:",
        "feat(orders): add idempotency keys to checkout endpoint · 12 files changed, +384 −127 · branch feat/idempotent-checkout → main",
        "This PR introduces idempotency keys on POST /api/v1/orders to prevent duplicate charges when the client retries on flaky network. Includes new middleware, DB migration for the idempotency_keys table, and updated integration tests.",
        "@ben-w wrote: \"This is the fix for the duplicate-order bug from incident #4421. I'd love a second pair of eyes on the migration before we ship — happy to walk through it on a call if easier.\"",
        "Required review from: @joey, @priya-l. CI status: ✓ all checks passed.",
      ],
      signoff: "—",
      signature: ["GitHub", "github.com/acme/api/pull/2841"],
      reply: "Reviewed and approved. Migration looks safe. LGTM ✓",
    },
    {
      initial: "K",
      color: "#1A73E8",
      name: "Kevin Lee",
      senderEmail: "kevin@studiolab.design",
      subject: "Friday's design review — moving to 3pm?",
      greeting: "Hey Joey,",
      paragraphs: [
        "Quick ask — can we push Friday's design review to 3pm instead of noon? Something came up at my kid's school and I have to do pickup at 11:30, no way I'd make it back in time and I don't want to be the guy who joins from his car.",
        "If 3pm doesn't work for you, I can also do Thursday afternoon or Monday morning of next week. Whatever's easiest. We've got the new flow mockups ready and I really want to get your feedback before we send them to the dev team.",
        "Also pasting in the prototype link so you can poke around beforehand if you have a minute: figma.com/file/xQ8mRZ — feedback on the empty state and the onboarding tooltips would be super helpful.",
        "Sorry for the reschedule. Let me know what works.",
      ],
      signoff: "Cheers,",
      signature: ["Kevin", "Design Lead · Studio Lab"],
      reply: "3pm works perfectly — calendar updated. Will review the flow beforehand.",
    },
    {
      initial: "J",
      color: "#0F9D58",
      name: "Jenna Park",
      senderEmail: "jenna.park@gmail.com",
      subject: "RE: dinner Friday? + Becca's birthday plan",
      greeting: "yo,",
      paragraphs: [
        "yessss I'm so in for Friday — 7:30 at Maialino works perfectly. you handling the reservation or want me to grab it? i can put it under my name if it's easier, just let me know in the next hour or two so we don't lose the slot.",
        "also TOTALLY unrelated but Becca's birthday is in like 3 weeks and a few of us are trying to plan something. i'm thinking of doing a little dinner thing at my place + maybe karaoke after?? would you be down? she keeps mentioning that she misses our bigger group hangs so i wanna make it special.",
        "if you're in i'm gonna start a thread with the usual suspects (sam, raj, mike, lisa). let me know!",
      ],
      signoff: "xx",
      signature: ["jenna"],
      reply: "I'll grab the res. Down for Becca's — count me in 🎉",
    },
    {
      initial: "T",
      color: "#1A73E8",
      name: "Thomas Kim",
      senderEmail: "tkim@chen-kim-legal.com",
      subject: "Re: contract review — clauses 4.2 and 7.1",
      greeting: "Joey,",
      paragraphs: [
        "Thanks for sending the redlined draft over. Mostly looks fine, but I have two material concerns I'd like to talk through before we sign.",
        "Clause 4.2 (IP assignment): the language as written assigns ALL prior IP, including work product from before the effective date. That's broader than what we discussed. I'd push for narrowing this to work product created in connection with services performed under this agreement only.",
        "Clause 7.1 (termination for convenience): the 30-day notice period feels short given the scope of the engagement. Industry standard for this size deal is 60-90 days. Worth pushing back on.",
        "Couple of smaller items in the redlines too — I marked them as comments. Can we get on a 30-minute call this week to walk through the changes? I'm flexible Tuesday afternoon or Wednesday morning.",
      ],
      signoff: "Best,",
      signature: ["Thomas Kim, Esq.", "Chen & Kim LLP"],
      reply: "Tuesday at 2pm works — sending invite now. Agree on both points.",
    },
  ];
  // Montage timing in driveSec. The montage starts at 1.4s and runs
  // INDEFINITELY through the rest of the Gmail lifetime — including
  // through the page's exit fade — so the rapid email-switching and
  // reply-typing stays visually alive instead of freezing on a
  // single email mid-fade.
  const montageStart = 1.4;
  const cyclesPerSec = 6.5;
  const cycleDur = 1 / cyclesPerSec;
  const activeSpeedupIndex = (() => {
    if (driveSec < montageStart) return 0;
    const cycle = Math.floor((driveSec - montageStart) / cycleDur);
    return cycle % speedupEmails.length;
  })();
  const activeEmail = speedupEmails[activeSpeedupIndex];
  // Typewriter progress for the reply text within the current cycle.
  const cycleProgress = (() => {
    if (driveSec < montageStart) return 0;
    const inCycle = ((driveSec - montageStart) % cycleDur) / cycleDur;
    return inCycle;
  })();
  const typedReplyChars = Math.floor(
    cycleProgress * activeEmail.reply.length,
  );
  const typedReplyText = activeEmail.reply.slice(0, typedReplyChars);
  const replyPreviewVisible = driveSec >= montageStart;

  // Email detail card slides up from the bottom starting around
  // driveSec 1.0s, fully covering the inbox by 1.4s. Stays visible
  // through the rest of the lifetime.
  const detailSlideStart = 1.0;
  const detailSlideEnd = 1.4;
  const detailSlideProgress = interpolate(
    driveSec,
    [detailSlideStart, detailSlideEnd],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
  const detailY = interpolate(detailSlideProgress, [0, 1], [height, 0]);

  // Gmail palette — DARK MODE (matches the iPhone reference). Colors
  // sampled from the actual iOS Gmail app's dark theme.
  const G_BG = "#1F1F1F"; // pure-dark inbox bg
  const G_BG_ELEVATED = "#2A2A2A"; // search bar / pill button bg
  const G_TEXT = "#E8EAED"; // primary text on dark
  const G_LIGHT = "#9AA0A6"; // secondary text
  const G_BORDER = "#3C4043"; // hairline divider
  const G_BLUE = "#8AB4F8"; // dark-mode primary accent
  const G_YELLOW = "#FCC934"; // Inbox label pill
  const G_GREEN = "#81C995"; // success
  const G_PROMO_BG = "#1E3327"; // green tint for the inline reply box

  type Email = {
    initial: string;
    color: string;
    name: string;
    subject: string;
    snippet: string;
    time: string;
    unread: boolean;
  };
  const emails: Email[] = [
    {
      initial: "B",
      color: "#5F6368",
      name: "Boss",
      subject: "Q4 review deck — needs your input",
      snippet:
        "Hey, can you take a look at the deck before tomorrow? A few...",
      time: "9:42 AM",
      unread: true,
    },
    {
      initial: "S",
      color: "#1A73E8",
      name: "Sarah from accounting",
      subject: "Re: expense reports",
      snippet: "Got it, processing those now. Just need confirmation on...",
      time: "9:18 AM",
      unread: true,
    },
    {
      initial: "M",
      color: "#EA4335",
      name: "Mom",
      subject: "Sunday dinner?",
      snippet:
        "Are you coming this Sunday? I'm making the lasagna you like...",
      time: "8:55 AM",
      unread: true,
    },
    {
      initial: "L",
      color: "#34A853",
      name: "LinkedIn",
      subject: "5 new job recommendations for you",
      snippet:
        "Senior Engineer at Acme · Director at Globex · and 3 more...",
      time: "8:30 AM",
      unread: false,
    },
    {
      initial: "C",
      color: "#FBBC04",
      name: "Calendar",
      subject: "Reminder: Team standup at 10:00",
      snippet: "You have a meeting in 18 minutes...",
      time: "8:42 AM",
      unread: false,
    },
    {
      initial: "T",
      color: "#1A73E8",
      name: "Thomas Kim",
      subject: "Re: contract review",
      snippet: "Thanks for sending this over. I have a few questions...",
      time: "Yesterday",
      unread: false,
    },
    {
      initial: "A",
      color: "#7B1FA2",
      name: "Apple",
      subject: "Your receipt from Apple",
      snippet: "Apple Music · $10.99 — billed to ····4829 on May 6...",
      time: "Yesterday",
      unread: false,
    },
    {
      initial: "J",
      color: "#0F9D58",
      name: "Jenna Park",
      subject: "RE: dinner Friday?",
      snippet: "yesss I'm in. 7:30 at Maialino works. let me know if...",
      time: "Yesterday",
      unread: true,
    },
    {
      initial: "G",
      color: "#1A73E8",
      name: "GitHub",
      subject: "[acme/api] PR #2841 needs review",
      snippet: "ben-w opened a pull request. 12 files changed, +384...",
      time: "Yesterday",
      unread: true,
    },
    {
      initial: "S",
      color: "#1DB954",
      name: "Spotify",
      subject: "Your Daylist · evening reset",
      snippet: "We made you a playlist for tonight — based on what you've...",
      time: "Yesterday",
      unread: false,
    },
    {
      initial: "D",
      color: "#FBBC04",
      name: "Dropbox",
      subject: "3 files shared with you",
      snippet: "alex@designteam.co shared budget-q4-final.xlsx and 2 more...",
      time: "Tue",
      unread: false,
    },
    {
      initial: "N",
      color: "#EA4335",
      name: "Netflix",
      subject: "New on Netflix this week",
      snippet: "Continue watching — 2 episodes left in season 3 of...",
      time: "Tue",
      unread: false,
    },
    {
      initial: "U",
      color: "#000000",
      name: "Uber",
      subject: "Your trip with Marcus on May 4",
      snippet: "$24.50 · 18 min · Castro to Mission. Rate your driver...",
      time: "Mon",
      unread: false,
    },
    {
      initial: "K",
      color: "#1A73E8",
      name: "Kevin Lee",
      subject: "Friday's design review",
      snippet: "Can we move it to 3pm? I've got a conflict at noon...",
      time: "Mon",
      unread: true,
    },
    {
      initial: "P",
      color: "#FF6F00",
      name: "Patagonia",
      subject: "20% off all fleeces this week",
      snippet: "Limited-time offer for members. Use code COZY at checkout...",
      time: "Mon",
      unread: false,
    },
    {
      initial: "R",
      color: "#34A853",
      name: "Robinhood",
      subject: "Earnings report: AAPL beat expectations",
      snippet: "Apple reported Q2 earnings of $1.52/share, beating the...",
      time: "Sun",
      unread: false,
    },
    {
      initial: "E",
      color: "#5F6368",
      name: "Eventbrite",
      subject: "You're going to Designers Mixer NYC",
      snippet: "Saved for May 18 · 7pm — your ticket is in your wallet...",
      time: "Sun",
      unread: false,
    },
    {
      initial: "V",
      color: "#1A73E8",
      name: "Vercel",
      subject: "Deployment ready · main",
      snippet: "marketing-site.vercel.app is live. Build took 42s, 0 errors...",
      time: "Sun",
      unread: false,
    },
    {
      initial: "F",
      color: "#1877F2",
      name: "Facebook",
      subject: "You have 4 new memories",
      snippet: "On this day in 2019 — you and Jenna at Dolores Park...",
      time: "Sat",
      unread: false,
    },
    {
      initial: "Z",
      color: "#2D8CFF",
      name: "Zoom",
      subject: "Your meeting recording is ready",
      snippet: "Q2 Planning · 47 min · transcript available in your...",
      time: "Sat",
      unread: false,
    },
  ];

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
        filter: `blur(${3 * scale}px) brightness(0.94) saturate(0.92)`,
        pointerEvents: "none",
        background: G_BG,
      }}
    >
      {/* Inbox view */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width,
          transform: `translateY(${pageY}px)`,
        }}
      >
        {/* Status bar spacer (transparent — IG/Amazon don't draw a
            status bar, leave the canvas's space for it) */}
        <div style={{ height: navH }} />
        {/* Top search row — iOS Gmail's signature pill containing
            hamburger + "Gmail" wordmark + account avatars + own avatar.
            Sits ABOVE the email list, dark-elevated bg. */}
        <div
          style={{
            paddingLeft: padX * 0.6,
            paddingRight: padX * 0.6,
            paddingBottom: 24 * scale,
          }}
        >
          <div
            style={{
              height: 88 * scale,
              borderRadius: 999,
              background: G_BG_ELEVATED,
              display: "flex",
              alignItems: "center",
              paddingLeft: 22 * scale,
              paddingRight: 8 * scale,
              gap: 16 * scale,
              fontFamily: FONT_STACK,
            }}
          >
            {/* Hamburger */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 * scale, flexShrink: 0 }}>
              <div style={{ width: 24 * scale, height: 3 * scale, background: G_TEXT, borderRadius: 2 }} />
              <div style={{ width: 24 * scale, height: 3 * scale, background: G_TEXT, borderRadius: 2 }} />
              <div style={{ width: 24 * scale, height: 3 * scale, background: G_TEXT, borderRadius: 2 }} />
            </div>
            {/* Gmail logo (envelope) */}
            <svg width={36 * scale} height={28 * scale} viewBox="0 0 36 28" fill="none">
              <path d="M2 4 L34 4 L34 24 L2 24 Z" fill="none" stroke="#FFFFFF" strokeWidth="0" />
              <path d="M2 4 L18 16 L34 4" fill="#EA4335" />
              <path d="M2 4 L2 24 L10 24 L10 12 Z" fill="#4285F4" />
              <path d="M34 4 L34 24 L26 24 L26 12 Z" fill="#34A853" />
              <path d="M10 12 L10 24 L26 24 L26 12 L18 18 Z" fill="#FBBC04" />
              <path d="M10 12 L18 18 L26 12 L18 4 Z" fill="#C5221F" />
            </svg>
            {/* Spacer */}
            <div style={{ flex: 1 }} />
            {/* Two presence dots — represent linked accounts in the
                actual iOS Gmail UI ("Inboxes • • •") */}
            <div style={{ display: "flex", gap: 4 * scale, marginRight: 4 * scale }}>
              <div style={{ width: 8 * scale, height: 8 * scale, borderRadius: "50%", background: "#34A853" }} />
              <div style={{ width: 8 * scale, height: 8 * scale, borderRadius: "50%", background: "#9AA0A6" }} />
              <div style={{ width: 8 * scale, height: 8 * scale, borderRadius: "50%", background: "#9AA0A6" }} />
            </div>
            {/* User avatar */}
            <div
              style={{
                width: 64 * scale,
                height: 64 * scale,
                borderRadius: "50%",
                background:
                  "linear-gradient(135deg, #C8B6A6 0%, #8C6E5A 100%)",
                flexShrink: 0,
              }}
            />
          </div>
        </div>
        {/* "All inboxes" small label */}
        <div
          style={{
            paddingLeft: padX,
            paddingRight: padX,
            paddingBottom: 16 * scale,
            fontFamily: FONT_STACK,
            fontSize: 22 * scale,
            color: G_LIGHT,
          }}
        >
          All inboxes
        </div>
        {/* Email list */}
        {emails.map((e, i) => (
          <div
            key={i}
            style={{
              minHeight: emailItemH,
              paddingLeft: padX,
              paddingRight: padX,
              paddingTop: 22 * scale,
              paddingBottom: 22 * scale,
              display: "flex",
              gap: 22 * scale,
              alignItems: "flex-start",
              fontFamily: FONT_STACK,
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: 80 * scale,
                height: 80 * scale,
                borderRadius: "50%",
                background: e.color,
                color: "#fff",
                fontSize: 38 * scale,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {e.initial}
            </div>
            {/* Body column */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 8 * scale,
                minWidth: 0,
              }}
            >
              {/* Sender row + time */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 12 * scale,
                }}
              >
                <div
                  style={{
                    fontSize: 30 * scale,
                    fontWeight: e.unread ? 700 : 500,
                    color: G_TEXT,
                    letterSpacing: -0.2 * scale,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    flex: 1,
                  }}
                >
                  {e.unread && (
                    <span
                      style={{
                        color: G_YELLOW,
                        fontWeight: 800,
                        marginRight: 6 * scale,
                      }}
                    >
                      ❯
                    </span>
                  )}
                  {e.name}
                </div>
                <div
                  style={{
                    fontSize: 20 * scale,
                    color: G_LIGHT,
                    flexShrink: 0,
                    fontWeight: e.unread ? 600 : 400,
                  }}
                >
                  {e.time}
                </div>
              </div>
              {/* Subject */}
              <div
                style={{
                  fontSize: 26 * scale,
                  fontWeight: e.unread ? 600 : 400,
                  color: G_TEXT,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  letterSpacing: -0.2 * scale,
                }}
              >
                {e.subject}
              </div>
              {/* Snippet */}
              <div
                style={{
                  fontSize: 22 * scale,
                  color: G_LIGHT,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  lineHeight: 1.3,
                }}
              >
                {e.snippet}
              </div>
            </div>
            {/* Star (right side) */}
            <div
              style={{
                fontSize: 32 * scale,
                color: G_LIGHT,
                flexShrink: 0,
                paddingTop: 30 * scale,
              }}
            >
              ☆
            </div>
          </div>
        ))}
      </div>

      {/* Compose FAB pill — bottom-right, with text + pencil icon
          like the actual iOS Gmail compose button */}
      {detailSlideProgress < 0.7 && (
        <div
          style={{
            position: "absolute",
            right: 32 * scale,
            bottom: 130 * scale,
            height: 110 * scale,
            paddingLeft: 36 * scale,
            paddingRight: 40 * scale,
            borderRadius: 999,
            background: "#1F4FB6",
            display: "flex",
            alignItems: "center",
            gap: 16 * scale,
            color: "#FFFFFF",
            fontFamily: FONT_STACK,
            fontSize: 32 * scale,
            fontWeight: 500,
            boxShadow: `0 ${10 * scale}px ${28 * scale}px rgba(31, 79, 182, 0.5)`,
            opacity: 1 - detailSlideProgress / 0.7,
          }}
        >
          {/* Pencil icon */}
          <svg width={36 * scale} height={36 * scale} viewBox="0 0 24 24" fill="none">
            <path
              d="M3 17.25 V21 H6.75 L17.81 9.93 L14.06 6.18 Z M20.71 7.04 C21.1 6.65 21.1 6.02 20.71 5.63 L18.37 3.29 C17.98 2.9 17.35 2.9 16.96 3.29 L15.13 5.12 L18.88 8.87 Z"
              fill="#FFFFFF"
            />
          </svg>
          Compose
        </div>
      )}

      {/* Email detail card — slides up from below to cover the
          inbox. Mirrors the iOS Gmail email-detail view: thin top
          action row with back + archive/trash/unread/more icons, big
          subject, "Inbox" label pill, sender row, body, then a
          bottom action bar with Reply / Reply all / Forward pills. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width,
          height,
          background: G_BG,
          transform: `translateY(${detailY}px)`,
          boxShadow: `0 ${-10 * scale}px ${30 * scale}px rgba(0,0,0,0.4)`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top action row — back + archive + trash + mark-unread + more */}
        <div
          style={{
            paddingLeft: padX,
            paddingRight: padX,
            paddingTop: navH,
            paddingBottom: 16 * scale,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: FONT_STACK,
            color: G_TEXT,
          }}
        >
          {/* Back chevron */}
          <svg width={48 * scale} height={48 * scale} viewBox="0 0 24 24" fill="none">
            <path
              d="M15 6 L9 12 L15 18"
              stroke={G_TEXT}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          {/* Right cluster: archive, trash, mark-unread, more */}
          <div style={{ display: "flex", gap: 36 * scale, alignItems: "center" }}>
            {/* Archive (down arrow into box) */}
            <svg width={36 * scale} height={36 * scale} viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="5" rx="1" fill={G_TEXT} />
              <rect x="4" y="9" width="16" height="12" rx="1" stroke={G_TEXT} strokeWidth="2" fill="none" />
              <line x1="9" y1="14" x2="15" y2="14" stroke={G_TEXT} strokeWidth="2" strokeLinecap="round" />
            </svg>
            {/* Trash */}
            <svg width={36 * scale} height={36 * scale} viewBox="0 0 24 24" fill="none">
              <path d="M5 7 L7 21 H17 L19 7 Z" stroke={G_TEXT} strokeWidth="2" fill="none" strokeLinejoin="round" />
              <line x1="3" y1="7" x2="21" y2="7" stroke={G_TEXT} strokeWidth="2" strokeLinecap="round" />
              <path d="M9 7 V5 C9 4 9.5 3 11 3 H13 C14.5 3 15 4 15 5 V7" stroke={G_TEXT} strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
            {/* Mark unread (envelope) */}
            <svg width={36 * scale} height={36 * scale} viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="14" rx="2" stroke={G_TEXT} strokeWidth="2" fill="none" />
              <path d="M3 7 L12 13 L21 7" stroke={G_TEXT} strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
            {/* More (3 dots) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 * scale }}>
              <div style={{ width: 6 * scale, height: 6 * scale, borderRadius: "50%", background: G_TEXT }} />
              <div style={{ width: 6 * scale, height: 6 * scale, borderRadius: "50%", background: G_TEXT }} />
              <div style={{ width: 6 * scale, height: 6 * scale, borderRadius: "50%", background: G_TEXT }} />
            </div>
          </div>
        </div>
        {/* Subject + Inbox label pill + star */}
        <div
          style={{
            paddingLeft: padX,
            paddingRight: padX,
            paddingTop: 16 * scale,
            paddingBottom: 20 * scale,
            display: "flex",
            alignItems: "flex-start",
            gap: 18 * scale,
            fontFamily: FONT_STACK,
          }}
        >
          <div
            style={{
              flex: 1,
              fontSize: 38 * scale,
              fontWeight: 500,
              color: G_TEXT,
              lineHeight: 1.25,
              letterSpacing: -0.3 * scale,
              display: "flex",
              alignItems: "baseline",
              gap: 14 * scale,
              flexWrap: "wrap",
            }}
          >
            <span>{activeEmail.subject}</span>
            <span
              style={{
                fontSize: 22 * scale,
                fontWeight: 500,
                color: G_YELLOW,
                whiteSpace: "nowrap",
              }}
            >
              ❯ Inbox
            </span>
          </div>
          {/* Star (filled blue, like the reference) */}
          <div style={{ fontSize: 36 * scale, color: G_BLUE, paddingTop: 4 * scale }}>★</div>
        </div>
        {/* Sender row */}
        <div
          style={{
            paddingLeft: padX,
            paddingRight: padX,
            display: "flex",
            alignItems: "center",
            gap: 18 * scale,
            paddingBottom: 28 * scale,
          }}
        >
          <div
            style={{
              width: 76 * scale,
              height: 76 * scale,
              borderRadius: "50%",
              background: activeEmail.color,
              color: "#fff",
              fontSize: 36 * scale,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {activeEmail.initial}
          </div>
          <div
            style={{
              flex: 1,
              fontFamily: FONT_STACK,
              display: "flex",
              flexDirection: "column",
              gap: 4 * scale,
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12 * scale,
              }}
            >
              <div style={{ fontSize: 26 * scale, fontWeight: 600, color: G_TEXT }}>
                {activeEmail.name}
              </div>
              <div style={{ fontSize: 20 * scale, color: G_LIGHT, whiteSpace: "nowrap" }}>
                Apr 30
              </div>
            </div>
            <div
              style={{
                fontSize: 20 * scale,
                color: G_LIGHT,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              to me ▾ · {activeEmail.senderEmail}
            </div>
          </div>
          {/* Right cluster: smile, back-arrow, ⋯ — like the iOS ref */}
          <div style={{ display: "flex", gap: 18 * scale, alignItems: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 24 * scale, color: G_LIGHT }}>☺</span>
            <svg width={28 * scale} height={28 * scale} viewBox="0 0 24 24" fill="none">
              <path d="M9 10 L4 14 L9 18" stroke={G_LIGHT} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 14 H14 C17 14 20 12 20 8 V6" stroke={G_LIGHT} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 * scale }}>
              <div style={{ width: 5 * scale, height: 5 * scale, borderRadius: "50%", background: G_LIGHT }} />
              <div style={{ width: 5 * scale, height: 5 * scale, borderRadius: "50%", background: G_LIGHT }} />
              <div style={{ width: 5 * scale, height: 5 * scale, borderRadius: "50%", background: G_LIGHT }} />
            </div>
          </div>
        </div>
        {/* Body — formatted like a real email: greeting, paragraphs,
            sign-off, and signature block. */}
        <div
          style={{
            paddingLeft: padX,
            paddingRight: padX,
            paddingTop: 0,
            paddingBottom: 16 * scale,
            fontFamily: FONT_STACK,
            fontSize: 26 * scale,
            color: G_TEXT,
            lineHeight: 1.5,
            flex: 1,
            overflow: "hidden",
          }}
        >
          {/* Greeting */}
          <div style={{ marginBottom: 22 * scale }}>{activeEmail.greeting}</div>
          {/* Paragraphs */}
          {activeEmail.paragraphs.map((p, i) => (
            <div key={i} style={{ marginBottom: 22 * scale }}>
              {p}
            </div>
          ))}
          {/* Sign-off */}
          <div style={{ marginBottom: 8 * scale, marginTop: 6 * scale }}>
            {activeEmail.signoff}
          </div>
          {/* Signature lines */}
          {activeEmail.signature.map((line, i) => (
            <div
              key={i}
              style={{
                color: i === 0 ? G_TEXT : G_LIGHT,
                fontWeight: i === 0 ? 600 : 400,
                fontSize: i === 0 ? 26 * scale : 22 * scale,
                lineHeight: 1.4,
              }}
            >
              {line}
            </div>
          ))}
        </div>
        {/* Inline reply preview — agent's typed-out response */}
        {replyPreviewVisible && (
          <div
            style={{
              marginLeft: padX,
              marginRight: padX,
              marginBottom: 18 * scale,
              padding: `${20 * scale}px ${22 * scale}px`,
              borderRadius: 18 * scale,
              background: G_PROMO_BG,
              border: `${2 * scale}px solid ${G_GREEN}`,
              display: "flex",
              alignItems: "flex-start",
              gap: 16 * scale,
              fontFamily: FONT_STACK,
            }}
          >
            <div
              style={{
                fontSize: 16 * scale,
                fontWeight: 700,
                color: G_GREEN,
                letterSpacing: 0.8 * scale,
                paddingTop: 4 * scale,
                whiteSpace: "nowrap",
              }}
            >
              REPLY
            </div>
            <div
              style={{
                flex: 1,
                fontSize: 26 * scale,
                color: G_TEXT,
                lineHeight: 1.4,
              }}
            >
              {typedReplyText}
              <span
                style={{
                  display: "inline-block",
                  width: 3 * scale,
                  height: 28 * scale,
                  marginLeft: 4 * scale,
                  background: G_GREEN,
                  verticalAlign: "text-bottom",
                  transform: "translateY(3px)",
                }}
              />
            </div>
          </div>
        )}
        {/* Bottom action bar — Reply / Reply all / Forward / smile */}
        <div
          style={{
            paddingLeft: padX,
            paddingRight: padX,
            paddingTop: 18 * scale,
            paddingBottom: 30 * scale,
            display: "flex",
            gap: 14 * scale,
            borderTop: `${1 * scale}px solid ${G_BORDER}`,
            background: G_BG,
          }}
        >
          {/* Reply pill */}
          <div
            style={{
              flex: 1,
              height: 90 * scale,
              borderRadius: 999,
              background: G_BG_ELEVATED,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10 * scale,
              fontFamily: FONT_STACK,
              fontSize: 24 * scale,
              fontWeight: 500,
              color: G_TEXT,
            }}
          >
            <svg width={26 * scale} height={26 * scale} viewBox="0 0 24 24" fill="none">
              <path d="M10 8 L4 12 L10 16" stroke={G_TEXT} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 12 H16 C19 12 21 14 21 17 V19" stroke={G_TEXT} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Reply
          </div>
          {/* Reply all pill (the tap target) */}
          <div
            style={{
              flex: 1,
              height: 90 * scale,
              borderRadius: 999,
              background: G_BG_ELEVATED,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10 * scale,
              fontFamily: FONT_STACK,
              fontSize: 24 * scale,
              fontWeight: 500,
              color: G_TEXT,
              transform: `scale(${replyAllScale})`,
              transformOrigin: "center",
            }}
          >
            <svg width={28 * scale} height={26 * scale} viewBox="0 0 28 24" fill="none">
              <path d="M9 8 L3 12 L9 16" stroke={G_TEXT} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 8 L8 12 L14 16" stroke={G_TEXT} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 12 H18 C21 12 23 14 23 17 V19" stroke={G_TEXT} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Reply all
          </div>
          {/* Forward pill */}
          <div
            style={{
              flex: 1,
              height: 90 * scale,
              borderRadius: 999,
              background: G_BG_ELEVATED,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10 * scale,
              fontFamily: FONT_STACK,
              fontSize: 24 * scale,
              fontWeight: 500,
              color: G_TEXT,
            }}
          >
            <svg width={26 * scale} height={26 * scale} viewBox="0 0 24 24" fill="none">
              <path d="M14 8 L20 12 L14 16" stroke={G_TEXT} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20 12 H8 C5 12 3 14 3 17 V19" stroke={G_TEXT} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Forward
          </div>
        </div>
      </div>

    </div>
  );
};

/**
 * Google-Docs-style mobile editor background. The agent "does the
 * homework" — a doc with a typed essay opens, the user scrolls
 * through it, taps Turn in, and a Google Classroom-style submission
 * confirmation appears.
 */
type GoogleDocsProps = {
  driveFrame: number;
  fps: number;
  width: number;
  height: number;
  scale: number;
  opacity: number;
  /** Tap-pulse on the Turn in button. */
  turnInScale?: number;
  /** Opacity for the homework-submitted confirmation overlay. */
  submitConfirmOpacity?: number;
};

const GoogleDocs: React.FC<GoogleDocsProps> = ({
  driveFrame,
  fps,
  width,
  height,
  scale,
  opacity,
  turnInScale = 1,
  submitConfirmOpacity = 0,
}) => {
  const padX = 28 * scale;
  const navH = 100 * scale;
  const toolbarH = 70 * scale;
  const docMarginX = 36 * scale;

  // Generate paragraph blocks (placeholder text bars representing
  // body paragraphs of the essay).
  const paragraphs: number[][] = [
    // Each paragraph is a list of line-widths as fractions of canvas
    // width — produces the realistic "uneven last line" look.
    [0.78, 0.86, 0.74, 0.81, 0.55],
    [0.82, 0.79, 0.84, 0.73, 0.66, 0.42],
    [0.76, 0.83, 0.79, 0.61],
    [0.85, 0.78, 0.82, 0.74, 0.79, 0.53],
    [0.81, 0.86, 0.74, 0.79, 0.6],
    [0.73, 0.82, 0.78, 0.84, 0.76, 0.31],
    [0.85, 0.79, 0.74, 0.49],
    [0.78, 0.83, 0.81, 0.74, 0.86, 0.62],
  ];
  const lineH = 28 * scale;
  const lineGap = 14 * scale;
  const paragraphGap = 28 * scale;
  const docTitleH = 70 * scale;
  const docAuthorH = 50 * scale;
  const docHeaderTotalH = docTitleH + docAuthorH + 30 * scale;
  const paragraphsH = paragraphs.reduce(
    (sum, p) =>
      sum + p.length * lineH + (p.length - 1) * lineGap + paragraphGap,
    0,
  );
  const totalContentH =
    navH + toolbarH + docHeaderTotalH + paragraphsH + 200 * scale;
  const maxScroll = Math.max(0, totalContentH - height);

  const driveSec = driveFrame / fps;
  let baseScroll = 0;
  if (driveSec < 0.4) {
    baseScroll = 0;
  } else if (driveSec < 1.2) {
    baseScroll = interpolate(driveSec, [0.4, 1.2], [0, maxScroll * 0.55], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
  } else {
    baseScroll = maxScroll * 0.55;
  }
  const wobble =
    driveSec > 0.4
      ? 4 * scale * Math.sin(2 * Math.PI * 2.5 * (driveSec - 0.4))
      : 0;
  const scrollPx = Math.min(maxScroll, Math.max(0, baseScroll + wobble));
  const pageY = -scrollPx;

  const D_BG = "#FFFFFF";
  const D_TEXT = "#202124";
  const D_LIGHT = "#5F6368";
  const D_BORDER = "#DADCE0";
  const D_BLUE = "#1A73E8";
  const D_TOOLBAR_BG = "#F8F9FA";
  const D_PAGE_BG = "#FFFFFF";
  const D_TEXT_BAR = "#3C4043";

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
        filter: `blur(${3 * scale}px) brightness(0.94) saturate(0.92)`,
        pointerEvents: "none",
        background: D_BG,
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
        {/* Doc nav bar */}
        <div
          style={{
            height: navH,
            paddingLeft: padX,
            paddingRight: padX,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: D_BG,
            borderBottom: `${1 * scale}px solid ${D_BORDER}`,
            fontFamily: FONT_STACK,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18 * scale,
              flex: 1,
              minWidth: 0,
            }}
          >
            <div style={{ fontSize: 36 * scale, color: D_TEXT, fontWeight: 300 }}>
              ←
            </div>
            <div
              style={{
                fontSize: 22 * scale,
                color: D_TEXT,
                fontWeight: 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              World History Essay - Final.docx
            </div>
          </div>
          <div style={{ display: "flex", gap: 22 * scale, fontSize: 26 * scale, color: D_LIGHT }}>
            <span>👥</span>
            <span>⋯</span>
          </div>
        </div>
        {/* Toolbar */}
        <div
          style={{
            height: toolbarH,
            paddingLeft: padX,
            paddingRight: padX,
            background: D_TOOLBAR_BG,
            borderBottom: `${1 * scale}px solid ${D_BORDER}`,
            display: "flex",
            alignItems: "center",
            gap: 22 * scale,
            fontFamily: FONT_STACK,
            fontSize: 22 * scale,
            color: D_LIGHT,
          }}
        >
          <span style={{ fontSize: 26 * scale }}>↶</span>
          <span style={{ fontSize: 26 * scale }}>↷</span>
          <div
            style={{
              padding: `${6 * scale}px ${14 * scale}px`,
              borderRadius: 6 * scale,
              border: `${1 * scale}px solid ${D_BORDER}`,
              background: D_BG,
              fontSize: 18 * scale,
            }}
          >
            Heading 1 ▾
          </div>
          <span style={{ fontWeight: 700, color: D_TEXT }}>B</span>
          <span style={{ fontStyle: "italic", color: D_TEXT }}>I</span>
          <span style={{ textDecoration: "underline", color: D_TEXT }}>U</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 26 * scale }}>＋</span>
        </div>
        {/* Doc canvas */}
        <div
          style={{
            background: D_PAGE_BG,
            paddingTop: 36 * scale,
            paddingBottom: 60 * scale,
            paddingLeft: docMarginX,
            paddingRight: docMarginX,
            fontFamily: FONT_STACK,
          }}
        >
          {/* Title */}
          <div
            style={{
              height: docTitleH,
              fontSize: 36 * scale,
              fontWeight: 700,
              color: D_TEXT,
              textAlign: "center",
              letterSpacing: -0.3 * scale,
              lineHeight: 1.2,
            }}
          >
            World War II: Causes and Consequences
          </div>
          <div
            style={{
              height: docAuthorH,
              fontSize: 20 * scale,
              color: D_LIGHT,
              textAlign: "center",
              marginTop: 8 * scale,
            }}
          >
            By Student · 5 pages · 1,247 words
          </div>
          {/* Body paragraphs (rendered as line bars) */}
          <div style={{ marginTop: 30 * scale }}>
            {paragraphs.map((para, pi) => (
              <div
                key={pi}
                style={{
                  marginBottom: paragraphGap,
                  display: "flex",
                  flexDirection: "column",
                  gap: lineGap,
                }}
              >
                {para.map((wfrac, li) => (
                  <div
                    key={li}
                    style={{
                      width: `${wfrac * 100}%`,
                      height: lineH,
                      background: D_TEXT_BAR,
                      borderRadius: 3 * scale,
                      opacity: 0.88,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        {/* Turn in bar (bottom of doc) */}
        <div
          style={{
            paddingLeft: padX,
            paddingRight: padX,
            paddingTop: 18 * scale,
            paddingBottom: 24 * scale,
            background: D_BG,
            borderTop: `${1 * scale}px solid ${D_BORDER}`,
          }}
        >
          <div
            style={{
              height: 90 * scale,
              borderRadius: 14 * scale,
              background: D_BLUE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_STACK,
              fontSize: 28 * scale,
              fontWeight: 600,
              color: "#fff",
              transform: `scale(${turnInScale})`,
              transformOrigin: "center",
              boxShadow: `0 ${4 * scale}px ${16 * scale}px rgba(26, 115, 232, 0.35)`,
            }}
          >
            Turn in
          </div>
        </div>
      </div>

      {/* Homework submitted — Google Classroom-style submission card.
          Green status banner at the top, assignment card with subject
          chip + teacher row + Docs attachment, rubric preview with
          mini progress bars, and a circular grade-prediction ring. */}
      {submitConfirmOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width,
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: submitConfirmOpacity,
            pointerEvents: "none",
            background: "rgba(0,0,0,0.35)",
          }}
        >
          <div
            style={{
              width: width * 0.84,
              borderRadius: 18 * scale,
              background: "#FFFFFF",
              fontFamily: FONT_STACK,
              boxShadow: `0 ${20 * scale}px ${60 * scale}px rgba(0,0,0,0.35)`,
              overflow: "hidden",
            }}
          >
            {/* Green status banner */}
            <div
              style={{
                background: "#0F9D58",
                padding: `${22 * scale}px ${28 * scale}px`,
                display: "flex",
                alignItems: "center",
                gap: 16 * scale,
              }}
            >
              {/* Graduation cap SVG */}
              <svg width={48 * scale} height={48 * scale} viewBox="0 0 48 48" fill="none">
                <path d="M24 6 L4 16 L24 26 L44 16 Z" fill="#FFFFFF" />
                <path d="M12 22 L12 32 C12 32 16 36 24 36 C32 36 36 32 36 32 L36 22" fill="#FFFFFF" />
                <line x1="44" y1="16" x2="44" y2="28" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="44" cy="30" r="2.5" fill="#FFFFFF" />
              </svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 28 * scale, fontWeight: 700, color: "#FFFFFF", letterSpacing: -0.3 * scale }}>
                  Turned in
                </div>
                <div style={{ fontSize: 16 * scale, color: "rgba(255,255,255,0.85)", marginTop: 2 * scale }}>
                  Submitted 3h 42m before deadline
                </div>
              </div>
              <div
                style={{
                  padding: `${6 * scale}px ${12 * scale}px`,
                  borderRadius: 999,
                  background: "#5BB974",
                  color: "#FFFFFF",
                  fontSize: 16 * scale,
                  fontWeight: 600,
                }}
              >
                On time
              </div>
            </div>
            {/* Assignment card */}
            <div
              style={{
                padding: `${24 * scale}px ${28 * scale}px`,
                paddingBottom: 16 * scale,
                display: "flex",
                flexDirection: "column",
                gap: 14 * scale,
              }}
            >
              {/* Subject chip */}
              <div
                style={{
                  alignSelf: "flex-start",
                  padding: `${5 * scale}px ${12 * scale}px`,
                  borderRadius: 999,
                  background: "#E6F4EA",
                  color: "#0F9D58",
                  fontSize: 16 * scale,
                  fontWeight: 600,
                }}
              >
                World History
              </div>
              {/* Title */}
              <div
                style={{
                  fontSize: 28 * scale,
                  fontWeight: 600,
                  color: "#202124",
                  letterSpacing: -0.3 * scale,
                  lineHeight: 1.25,
                }}
              >
                The Industrial Revolution: Causes and Consequences
              </div>
              {/* Teacher row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12 * scale,
                }}
              >
                <div
                  style={{
                    width: 44 * scale,
                    height: 44 * scale,
                    borderRadius: "50%",
                    background: "#1A73E8",
                    color: "#FFFFFF",
                    fontSize: 18 * scale,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  MA
                </div>
                <div style={{ fontSize: 18 * scale, color: "#5F6368" }}>
                  Mr. Anderson · Period 4
                </div>
              </div>
              {/* Document attachment row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14 * scale,
                  padding: `${12 * scale}px ${16 * scale}px`,
                  borderRadius: 8 * scale,
                  border: `${1 * scale}px solid #DADCE0`,
                  marginTop: 4 * scale,
                }}
              >
                {/* Docs file icon */}
                <svg width={42 * scale} height={42 * scale} viewBox="0 0 42 42" fill="none">
                  <path d="M28 4 H10 C8 4 6 6 6 8 V34 C6 36 8 38 10 38 H32 C34 38 36 36 36 34 V12 Z" fill="#4285F4" />
                  <path d="M28 4 V12 H36 Z" fill="#1967D2" />
                  <line x1="13" y1="20" x2="29" y2="20" stroke="#FFFFFF" strokeWidth="1.5" />
                  <line x1="13" y1="25" x2="29" y2="25" stroke="#FFFFFF" strokeWidth="1.5" />
                  <line x1="13" y1="30" x2="23" y2="30" stroke="#FFFFFF" strokeWidth="1.5" />
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 19 * scale, fontWeight: 500, color: "#202124" }}>
                    essay-final.gdoc
                  </div>
                  <div style={{ fontSize: 15 * scale, color: "#5F6368", marginTop: 2 * scale }}>
                    5 pages · 1,247 words · Last edit 2m ago
                  </div>
                </div>
              </div>
            </div>
            {/* Rubric preview */}
            <div
              style={{
                padding: `${20 * scale}px ${28 * scale}px`,
                paddingTop: 12 * scale,
                paddingBottom: 12 * scale,
                background: "#F8F9FA",
                display: "flex",
                gap: 22 * scale,
                alignItems: "center",
              }}
            >
              {/* Grade ring */}
              <div style={{ position: "relative", width: 100 * scale, height: 100 * scale, flexShrink: 0 }}>
                <svg width={100 * scale} height={100 * scale} viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" stroke="#E0E0E0" strokeWidth="8" fill="none" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="#0F9D58"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray="232 264"
                    strokeDashoffset="0"
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div style={{ fontSize: 28 * scale, fontWeight: 700, color: "#0F9D58", lineHeight: 1 }}>
                    A−
                  </div>
                  <div style={{ fontSize: 11 * scale, color: "#5F6368", marginTop: 2 * scale }}>
                    Est. 88%
                  </div>
                </div>
              </div>
              {/* Rubric bars */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 * scale }}>
                {[
                  { label: "Thesis", pct: 95, color: "#34A853" },
                  { label: "Evidence", pct: 88, color: "#34A853" },
                  { label: "Analysis", pct: 78, color: "#FBBC04" },
                  { label: "Mechanics", pct: 92, color: "#34A853" },
                ].map((r) => (
                  <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8 * scale }}>
                    <div style={{ width: 80 * scale, fontSize: 14 * scale, color: "#5F6368", fontWeight: 500 }}>
                      {r.label}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        height: 8 * scale,
                        borderRadius: 4 * scale,
                        background: "#F1F3F4",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${r.pct}%`,
                          height: "100%",
                          background: r.color,
                          borderRadius: 4 * scale,
                        }}
                      />
                    </div>
                    <div style={{ width: 32 * scale, fontSize: 13 * scale, color: "#202124", fontWeight: 600, textAlign: "right" }}>
                      {r.pct}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Footer */}
            <div
              style={{
                padding: `${16 * scale}px ${28 * scale}px`,
                background: "#E6F4EA",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 18 * scale,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8 * scale,
                  color: "#0F9D58",
                  fontWeight: 600,
                }}
              >
                <span>🛡</span>
                Originality: 100% original
              </div>
              <div style={{ color: "#0F9D58", fontWeight: 600 }}>
                View in Classroom →
              </div>
            </div>
          </div>
        </div>
      )}
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

  // (Conversation shift is computed below, after bubble dimensions
  // are defined — see the block right before `sentBubbleY`.)

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

  // Sent3 (third blue bubble) — pops in after received #3 with the
  // initial phrase, then gets "edited": the user backspaces the
  // existing text and types a new phrase ("book my flight and
  // hotel") in its place. The bubble width animates in lockstep so
  // it always snugly fits the current text.
  const sent3PhraseInitial = "bet, order some protection";
  const sent3PhraseEdited = "book my flight and hotel";
  const sent3PhraseEdited2 = "pay off my credit card";
  const sent3PhraseEdited3 = "respond to all my emails";
  const sent3PhraseEdited4 = "do my homework plz";
  const sent3FontSize = bubbleFontSize;
  const sent3PadX = bubblePadX;
  const sent3Height = bubbleHeight;
  const sent3CornerRadius = sent3Height * 0.42;
  const sent3TailExt = sent3CornerRadius * 0.5;
  const sent3TailHook = sent3CornerRadius * 0.2;
  // 0.4s pause after received #3 settles (12.95s) before the prior-
  // bubbles fade-out starts (sent3Start - 0.3s ≈ 13.5s). The viewer
  // gets a beat to read the gray reply burst before the punchline.
  const sent3Start = sec(13.8, fps);
  // sent #3 lands as the punchline of the scene — everything else
  // fades out so this bubble sits alone on screen, and it enters
  // with a more pronounced expand (0.5 → 1.0 scale, slower settle
  // than the other bubbles' pop-ins).
  const sent3Spring = spring({
    frame: local - sent3Start,
    fps,
    config: { damping: 16, stiffness: 110, mass: 0.7 },
  });
  // Sent #3 is the closing punchline — settles at 1.7× scale so it
  // dominates the screen center, much larger than every other bubble.
  const sent3Scale = interpolate(sent3Spring, [0, 1], [0.5, 1.7]);
  const sent3Opacity = interpolate(
    local,
    [sent3Start, sent3Start + sec(0.25, fps)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );

  // ── Sent #3 "edit" animation ────────────────────────────────────
  // After the Amazon page has dismissed, sent #3 simulates a user
  // editing the message: the existing text backspaces character by
  // character, brief pause, then a new phrase types out in its
  // place. The bubble width animates to fit the current text so it
  // always snugly wraps whatever's visible.
  //
  // ── Edit phase array ─────────────────────────────────────────
  // Each phase is one "rewrite": backspace the previous phrase, then
  // type a new phrase in its place. The state machine walks through
  // the array sequentially based on `local` time. To add another
  // edit, just append to `editPhases`.
  const editBackspaceCharsPerSec = 30;
  const editTypeCharsPerSec = 25;
  const editPauseDurSec = 0.2;
  type EditPhase = {
    backspaceStart: number; // frames (Scene 3 local)
    fromPhrase: string;
    toPhrase: string;
  };
  const editPhases: EditPhase[] = [
    {
      backspaceStart: sec(14.3, fps),
      fromPhrase: sent3PhraseInitial,
      toPhrase: sent3PhraseEdited,
    },
    {
      // Edit 2 — happens during Apple Wallet's open.
      backspaceStart: sec(19.4, fps),
      fromPhrase: sent3PhraseEdited,
      toPhrase: sent3PhraseEdited2,
    },
    {
      // Edit 3 — happens during Gmail's open.
      backspaceStart: sec(24.3, fps),
      fromPhrase: sent3PhraseEdited2,
      toPhrase: sent3PhraseEdited3,
    },
    {
      // Edit 4 — happens during Google Docs' open.
      backspaceStart: sec(29.2, fps),
      fromPhrase: sent3PhraseEdited3,
      toPhrase: sent3PhraseEdited4,
    },
  ];

  // Compute, for each phase, its derived timestamps.
  type EditPhaseTiming = {
    backspaceStart: number;
    backspaceEnd: number;
    typeStart: number;
    typeEnd: number;
    fromPhrase: string;
    toPhrase: string;
  };
  const editPhaseTimings: EditPhaseTiming[] = editPhases.map((p) => {
    const backspaceDur = sec(
      p.fromPhrase.length / editBackspaceCharsPerSec,
      fps,
    );
    const typeDur = sec(p.toPhrase.length / editTypeCharsPerSec, fps);
    const backspaceEnd = p.backspaceStart + backspaceDur;
    const typeStart = backspaceEnd + sec(editPauseDurSec, fps);
    const typeEnd = typeStart + typeDur;
    return {
      backspaceStart: p.backspaceStart,
      backspaceEnd,
      typeStart,
      typeEnd,
      fromPhrase: p.fromPhrase,
      toPhrase: p.toPhrase,
    };
  });

  // Walk phases to figure out the visible text right now.
  let sent3VisibleText: string = sent3PhraseInitial;
  for (let i = 0; i < editPhaseTimings.length; i++) {
    const phase = editPhaseTimings[i];
    if (local < phase.backspaceStart) {
      sent3VisibleText =
        i === 0 ? sent3PhraseInitial : editPhaseTimings[i - 1].toPhrase;
      break;
    } else if (local < phase.backspaceEnd) {
      const elapsed = (local - phase.backspaceStart) / fps;
      const removed = Math.floor(elapsed * editBackspaceCharsPerSec);
      sent3VisibleText = phase.fromPhrase.slice(
        0,
        Math.max(0, phase.fromPhrase.length - removed),
      );
      break;
    } else if (local < phase.typeStart) {
      sent3VisibleText = "";
      break;
    } else if (local < phase.typeEnd) {
      const elapsed = (local - phase.typeStart) / fps;
      const typed = Math.floor(elapsed * editTypeCharsPerSec);
      sent3VisibleText = phase.toPhrase.slice(
        0,
        Math.min(phase.toPhrase.length, typed),
      );
      break;
    } else {
      sent3VisibleText = phase.toPhrase;
    }
  }

  // Bubble width tracks the current visible text's width so the
  // bubble snugly fits whatever's showing.
  const sent3CurrentTextWidth =
    measureTextEm(sent3VisibleText) * sent3FontSize;
  const sent3MinTextWidth = sent3FontSize * 0.5;
  const sent3Width =
    Math.max(sent3CurrentTextWidth, sent3MinTextWidth) + sent3PadX * 2;

  // Cursor blink — visible during ANY edit phase. Hidden once all
  // phases have settled.
  const firstPhase = editPhaseTimings[0];
  const lastPhase = editPhaseTimings[editPhaseTimings.length - 1];
  const editActive =
    local >= firstPhase.backspaceStart && local <= lastPhase.typeEnd;
  const cursorBlinkPeriodFrames = sec(0.5, fps);
  const cursorVisibleSent3 =
    editActive &&
    Math.floor(
      (local - firstPhase.backspaceStart) / cursorBlinkPeriodFrames,
    ) %
      2 ===
      0;

  // Prior-bubbles + caption fade-out, timed JUST BEFORE sent #3
  // arrives. By the time sent #3 starts springing in, the rest of
  // the conversation (and the caption) has dissolved away — leaving
  // sent #3 alone on screen as the closing punchline.
  const priorFadeStart = sent3Start - sec(0.3, fps);
  const priorFadeEnd = sent3Start - sec(0.05, fps);
  const priorBubblesOpacity = interpolate(
    local,
    [priorFadeStart, priorFadeEnd],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );

  // ── Amazon product page background (closing punchline context) ──
  // While sent #3 ("bet, order some protection") is alone on screen,
  // an Amazon product listing slides in behind it with the same
  // iOS-style "open app" zoom we used for the IG profile. Reads as
  // "the agent is checking out a product page right now."
  // Origin point is the LOWER-LEFT of the canvas this time (the IG
  // entry was lower-right) so the two app-open animations don't feel
  // identical when stitched in the same scene.
  const amazonFadeStart = sent3Start; // arrives as sent #3 enters
  const amazonOpenSpring = spring({
    frame: local - amazonFadeStart,
    fps,
    config: { damping: 16, stiffness: 110, mass: 0.65 },
  });
  const amazonOpenScale = interpolate(amazonOpenSpring, [0, 1], [0.15, 1]);
  const amazonOpenRadius = interpolate(
    amazonOpenSpring,
    [0, 1],
    [80 * scale, 0],
  );
  const amazonFadeIn = interpolate(
    local,
    [amazonFadeStart, amazonFadeStart + sec(0.18, fps)],
    [0, 0.45],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );

  // ── Buy-Now button tap + Amazon exit ──────────────────────────
  // Once the Amazon page has settled, the agent "taps" the Buy Now
  // button (small scale-down/up pulse), then the page fades and
  // lifts away — same exit pattern as the IG profile. The "bet,
  // order some protection" bubble stays put through all of this.
  const buyTapStart = sec(14.5, fps);
  const buyTapEnd = sec(14.7, fps);
  const tapHalf = (buyTapEnd - buyTapStart) / 2;
  const buyTapDown = interpolate(
    local,
    [buyTapStart, buyTapStart + tapHalf],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
  const buyTapUp = interpolate(
    local,
    [buyTapStart + tapHalf, buyTapEnd],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
  // 1 → 0.94 → 1 across the tap window.
  const buyButtonTapScale = 1 - buyTapDown * 0.06 + buyTapUp * 0.06;

  // Amazon exit: fade + drift up. Starts right after the tap
  // releases ("button pressed → page dismisses").
  const amazonExitStart = buyTapEnd;
  const amazonExitEnd = amazonExitStart + sec(0.5, fps);
  const amazonExitFadeMul = interpolate(
    local,
    [amazonExitStart, amazonExitEnd],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );
  const amazonExitDriftY = interpolate(
    local,
    [amazonExitStart, amazonExitEnd],
    [0, -50 * scale],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );
  const amazonOpacity = amazonFadeIn * amazonExitFadeMul;

  // ── Flight search page (after Amazon dismisses) ─────────────────
  // Same iOS app-open pattern, but anchored to the lower-CENTER of
  // the canvas this time (different from IG's lower-right and
  // Amazon's lower-left). Reads as the agent opening a 3rd app
  // mid-task. Includes a tap-pulse on the cheapest flight result +
  // a "Booking confirmed" toast.
  const flightFadeStart = amazonExitEnd + sec(0.05, fps);
  const flightOpenSpring = spring({
    frame: local - flightFadeStart,
    fps,
    config: { damping: 16, stiffness: 110, mass: 0.65 },
  });
  const flightOpenScale = interpolate(flightOpenSpring, [0, 1], [0.15, 1]);
  const flightOpenRadius = interpolate(
    flightOpenSpring,
    [0, 1],
    [80 * scale, 0],
  );
  const flightFadeIn = interpolate(
    local,
    [flightFadeStart, flightFadeStart + sec(0.18, fps)],
    [0, 0.45],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );

  // Tap on the cheapest flight result card.
  const flightTapStart = sec(16.5, fps);
  const flightTapEnd = sec(16.7, fps);
  const flightTapHalf = (flightTapEnd - flightTapStart) / 2;
  const flightTapDown = interpolate(
    local,
    [flightTapStart, flightTapStart + flightTapHalf],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
  const flightTapUp = interpolate(
    local,
    [flightTapStart + flightTapHalf, flightTapEnd],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
  const flightCardTapScale = 1 - flightTapDown * 0.04 + flightTapUp * 0.04;
  // Index of the card the agent taps. Picks a card that's visible
  // mid-screen at tap time given the flight page's scroll position.
  // (At driveSec ≈ 1.25s the page is in `flickEnd` state, so cards
  // 3-5 are roughly mid-canvas. Index 3 lands well-centered.)
  const flightTappedCardIndex = 3;
  // Scroll freezes the moment the tap fires so the selected card
  // stays in view while the booking confirmation overlays it.
  const flightScrollFreezeAtSec =
    (flightTapStart - flightFadeStart) / fps;

  // Booking-confirmed card: appears after the tap, holds for a
  // longer beat so viewers can read the flight details, then fades.
  const bookingToastInStart = flightTapEnd;
  const bookingToastInEnd = bookingToastInStart + sec(0.25, fps);
  const bookingToastOutStart = bookingToastInStart + sec(1.4, fps);
  const bookingToastOutEnd = bookingToastOutStart + sec(0.35, fps);
  const bookingToastIn = interpolate(
    local,
    [bookingToastInStart, bookingToastInEnd],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  const bookingToastOut = interpolate(
    local,
    [bookingToastOutStart, bookingToastOutEnd],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );
  const bookingConfirmOpacity = bookingToastIn * bookingToastOut;

  // Flight page exit — fade + drift up after the toast fades.
  const flightExitStart = bookingToastOutEnd;
  const flightExitEnd = flightExitStart + sec(0.5, fps);
  const flightExitFadeMul = interpolate(
    local,
    [flightExitStart, flightExitEnd],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );
  const flightExitDriftY = interpolate(
    local,
    [flightExitStart, flightExitEnd],
    [0, -50 * scale],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );
  const flightOpacity = flightFadeIn * flightExitFadeMul;

  // ── Apple Wallet (edit 3: "pay off my credit card") ────────────
  // Opens after Flight Search exits, with the iOS app-open zoom
  // anchored to the UPPER-RIGHT of the canvas so the home-screen
  // origin doesn't repeat across the 4 backgrounds we now have.
  const walletFadeStart = flightExitEnd + sec(0.05, fps);
  const walletOpenSpring = spring({
    frame: local - walletFadeStart,
    fps,
    config: { damping: 16, stiffness: 110, mass: 0.65 },
  });
  const walletOpenScale = interpolate(walletOpenSpring, [0, 1], [0.15, 1]);
  const walletOpenRadius = interpolate(
    walletOpenSpring,
    [0, 1],
    [80 * scale, 0],
  );
  const walletFadeIn = interpolate(
    local,
    [walletFadeStart, walletFadeStart + sec(0.18, fps)],
    [0, 0.45],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );

  // Pay button tap window.
  const payTapStart = sec(21.5, fps);
  const payTapEnd = sec(21.7, fps);
  const payTapHalf = (payTapEnd - payTapStart) / 2;
  const payTapDown = interpolate(
    local,
    [payTapStart, payTapStart + payTapHalf],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
  const payTapUp = interpolate(
    local,
    [payTapStart + payTapHalf, payTapEnd],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
  const payButtonTapScale = 1 - payTapDown * 0.06 + payTapUp * 0.06;

  // "Payment Sent" confirmation toast.
  const paymentToastInStart = payTapEnd;
  const paymentToastInEnd = paymentToastInStart + sec(0.25, fps);
  const paymentToastOutStart = paymentToastInStart + sec(1.3, fps);
  const paymentToastOutEnd = paymentToastOutStart + sec(0.35, fps);
  const paymentToastIn = interpolate(
    local,
    [paymentToastInStart, paymentToastInEnd],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  const paymentToastOut = interpolate(
    local,
    [paymentToastOutStart, paymentToastOutEnd],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );
  const paymentConfirmOpacity = paymentToastIn * paymentToastOut;

  // Wallet page exit.
  const walletExitStart = paymentToastOutEnd;
  const walletExitEnd = walletExitStart + sec(0.5, fps);
  const walletExitFadeMul = interpolate(
    local,
    [walletExitStart, walletExitEnd],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );
  const walletExitDriftY = interpolate(
    local,
    [walletExitStart, walletExitEnd],
    [0, -50 * scale],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );
  const walletOpacity = walletFadeIn * walletExitFadeMul;

  // ── Gmail (edit 4: "respond to all my emails") ─────────────────
  // Opens after Apple Wallet exits, with the iOS app-open zoom
  // anchored to the UPPER-LEFT (companion to Wallet's upper-right).
  const gmailFadeStart = walletExitEnd + sec(0.05, fps);
  const gmailOpenSpring = spring({
    frame: local - gmailFadeStart,
    fps,
    config: { damping: 16, stiffness: 110, mass: 0.65 },
  });
  const gmailOpenScale = interpolate(gmailOpenSpring, [0, 1], [0.15, 1]);
  const gmailOpenRadius = interpolate(
    gmailOpenSpring,
    [0, 1],
    [80 * scale, 0],
  );
  const gmailFadeIn = interpolate(
    local,
    [gmailFadeStart, gmailFadeStart + sec(0.18, fps)],
    [0, 0.45],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );

  // Reply All chip tap.
  const replyAllTapStart = sec(26.4, fps);
  const replyAllTapEnd = sec(26.6, fps);
  const replyAllTapHalf = (replyAllTapEnd - replyAllTapStart) / 2;
  const replyAllTapDown = interpolate(
    local,
    [replyAllTapStart, replyAllTapStart + replyAllTapHalf],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
  const replyAllTapUp = interpolate(
    local,
    [replyAllTapStart + replyAllTapHalf, replyAllTapEnd],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
  const replyAllScale = 1 - replyAllTapDown * 0.06 + replyAllTapUp * 0.06;

  // "Replied to 47 emails" confirmation toast.
  const replyToastInStart = replyAllTapEnd;
  const replyToastInEnd = replyToastInStart + sec(0.25, fps);
  const replyToastOutStart = replyToastInStart + sec(1.3, fps);
  const replyToastOutEnd = replyToastOutStart + sec(0.35, fps);
  const replyToastIn = interpolate(
    local,
    [replyToastInStart, replyToastInEnd],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  const replyToastOut = interpolate(
    local,
    [replyToastOutStart, replyToastOutEnd],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );
  const replySentOpacity = replyToastIn * replyToastOut;

  // Gmail page exit.
  const gmailExitStart = replyToastOutEnd;
  const gmailExitEnd = gmailExitStart + sec(0.5, fps);
  const gmailExitFadeMul = interpolate(
    local,
    [gmailExitStart, gmailExitEnd],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );
  const gmailExitDriftY = interpolate(
    local,
    [gmailExitStart, gmailExitEnd],
    [0, -50 * scale],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );
  const gmailOpacity = gmailFadeIn * gmailExitFadeMul;

  // ── Google Docs (edit 5: "do my homework plz") ─────────────────
  // Opens after Gmail exits. iOS app-open zoom anchored to the
  // UPPER-CENTER (the 6th and final unique home-screen origin).
  const docsFadeStart = gmailExitEnd + sec(0.05, fps);
  const docsOpenSpring = spring({
    frame: local - docsFadeStart,
    fps,
    config: { damping: 16, stiffness: 110, mass: 0.65 },
  });
  const docsOpenScale = interpolate(docsOpenSpring, [0, 1], [0.15, 1]);
  const docsOpenRadius = interpolate(
    docsOpenSpring,
    [0, 1],
    [80 * scale, 0],
  );
  const docsFadeIn = interpolate(
    local,
    [docsFadeStart, docsFadeStart + sec(0.18, fps)],
    [0, 0.45],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );

  // Turn in button tap.
  const turnInTapStart = sec(31.1, fps);
  const turnInTapEnd = sec(31.3, fps);
  const turnInTapHalf = (turnInTapEnd - turnInTapStart) / 2;
  const turnInTapDown = interpolate(
    local,
    [turnInTapStart, turnInTapStart + turnInTapHalf],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
  const turnInTapUp = interpolate(
    local,
    [turnInTapStart + turnInTapHalf, turnInTapEnd],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
  const turnInScale = 1 - turnInTapDown * 0.06 + turnInTapUp * 0.06;

  // Homework submitted confirmation toast.
  const submitToastInStart = turnInTapEnd;
  const submitToastInEnd = submitToastInStart + sec(0.25, fps);
  const submitToastOutStart = submitToastInStart + sec(1.3, fps);
  const submitToastOutEnd = submitToastOutStart + sec(0.35, fps);
  const submitToastIn = interpolate(
    local,
    [submitToastInStart, submitToastInEnd],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  const submitToastOut = interpolate(
    local,
    [submitToastOutStart, submitToastOutEnd],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );
  const submitConfirmOpacity = submitToastIn * submitToastOut;

  // Docs page exit.
  const docsExitStart = submitToastOutEnd;
  const docsExitEnd = docsExitStart + sec(0.5, fps);
  const docsExitFadeMul = interpolate(
    local,
    [docsExitStart, docsExitEnd],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );
  const docsExitDriftY = interpolate(
    local,
    [docsExitStart, docsExitEnd],
    [0, -50 * scale],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    },
  );
  const docsOpacity = docsFadeIn * docsExitFadeMul;

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
  const received3TopAnchorY =
    typing2TopAnchorAfter + received2Height + sameSenderGap;
  const received3YOffset = received3TopAnchorY + received3Height / 2;
  // Sent #3 sits below received #3 with the FULL inter-sender gap
  // (sender changes from gray to blue). The bubble is right-aligned
  // like the other blue bubbles.
  const sent3YOffset =
    received3TopAnchorY + received3Height + receivedGap + sent3Height / 2;

  // ── Conversation shift (newest bubble at midline) ────────────────
  //
  // Instead of balancing the stack around the screen midline (where
  // older bubbles drift up and newer ones extend below), we keep
  // the NEWEST bubble centered on the midline. Each new bubble that
  // arrives ramps `conversationShift` toward `-thatBubbleYOffset`,
  // so that bubble (positioned at `sentBubbleY + thatBubbleYOffset`)
  // lands exactly at `height/2`. Older bubbles, which have smaller
  // YOffsets, drift upward off-screen.
  //
  // Easing is cubic-out per segment so each shift decelerates into
  // place. Each new bubble's shift is anchored to that bubble's
  // pop-in window, so the stack scrolls in sync with the bubble
  // settling.
  // typing #2 settles to bubbleHeight/2 below typing2TopAnchorAfter
  // (the post-slide position).
  const typing2YOffsetSettled =
    typing2TopAnchorAfter + bubbleHeight / 2;
  let conversationShift = 0;
  // 1) Received #1 becomes the newest.
  conversationShift = interpolate(
    local,
    [receivedStart, receivedEnd],
    [conversationShift, -receivedYOffset],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  // 2) Sent #2 becomes the newest.
  conversationShift = interpolate(
    local,
    [sent2Start, sent2End],
    [conversationShift, -sent2YOffset],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  // 3) Image attachment becomes the newest (lands via the IG flight).
  conversationShift = interpolate(
    local,
    [igFlightStart, igFlightEnd],
    [conversationShift, -imageBubbleYOffset],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  // 4) Typing #2 → received #2 (text reply).
  conversationShift = interpolate(
    local,
    [typing2MorphStart, typing2MorphEnd],
    [conversationShift, -typing2YOffsetSettled],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  // 5) Received #3.
  conversationShift = interpolate(
    local,
    [sec(12.6, fps), sec(12.95, fps)],
    [conversationShift, -received3YOffset],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  // 6) Sent #3 (closing reply) becomes the newest.
  conversationShift = interpolate(
    local,
    [sec(13.8, fps), sec(14.25, fps)],
    [conversationShift, -sent3YOffset],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );

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

      {/* Amazon product page background — appears as sent #3 enters,
          with the same iOS "open app" zoom we used for IG (but
          anchored to the LOWER-LEFT of the canvas this time, so the
          two app-open animations don't feel identical). Sits behind
          the closing punchline bubble. */}
      {amazonOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width,
            height,
            transformOrigin: `${width * 0.22}px ${height * 0.82}px`,
            transform: `translateY(${amazonExitDriftY}px) scale(${amazonOpenScale})`,
            borderRadius: amazonOpenRadius,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <AmazonProduct
            driveFrame={local - amazonFadeStart}
            fps={fps}
            width={width}
            height={height}
            scale={scale}
            opacity={amazonOpacity}
            buyButtonScale={buyButtonTapScale}
          />
        </div>
      )}

      {/* Flight search page — appears after Amazon dismisses, with
          the iOS "open app" zoom anchored to the LOWER-CENTER of the
          canvas so it feels distinct from the IG (lower-right) and
          Amazon (lower-left) entries. Tap-pulse on the cheapest
          flight + a "Booking confirmed" toast, then exits. */}
      {flightOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width,
            height,
            transformOrigin: `${width * 0.5}px ${height * 0.85}px`,
            transform: `translateY(${flightExitDriftY}px) scale(${flightOpenScale})`,
            borderRadius: flightOpenRadius,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <FlightSearch
            driveFrame={local - flightFadeStart}
            fps={fps}
            width={width}
            height={height}
            scale={scale}
            opacity={flightOpacity}
            cardTapScale={flightCardTapScale}
            tappedCardIndex={flightTappedCardIndex}
            // Freeze scroll once the tap fires so the selected card
            // stays in view while the confirmation overlays the page.
            scrollFreezeAtSec={
              local >= flightTapStart ? flightScrollFreezeAtSec : undefined
            }
            bookingConfirmOpacity={bookingConfirmOpacity}
          />
        </div>
      )}

      {/* Apple Wallet — opens after Flight Search dismisses, with
          the iOS app-open zoom anchored to the UPPER-RIGHT (a fresh
          home-screen origin not used by the previous three apps).
          Tap-pulse on the Pay button + "Payment Sent" confirmation. */}
      {walletOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width,
            height,
            transformOrigin: `${width * 0.78}px ${height * 0.18}px`,
            transform: `translateY(${walletExitDriftY}px) scale(${walletOpenScale})`,
            borderRadius: walletOpenRadius,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <AppleWallet
            driveFrame={local - walletFadeStart}
            fps={fps}
            width={width}
            height={height}
            scale={scale}
            opacity={walletOpacity}
            payButtonScale={payButtonTapScale}
            paymentConfirmOpacity={paymentConfirmOpacity}
          />
        </div>
      )}

      {/* Gmail — opens after Apple Wallet exits, with the iOS app-
          open zoom anchored to the UPPER-LEFT (companion to Wallet's
          upper-right). Tap-pulse on the Reply All chip + "Replied to
          47 emails" confirmation. */}
      {gmailOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width,
            height,
            transformOrigin: `${width * 0.22}px ${height * 0.18}px`,
            transform: `translateY(${gmailExitDriftY}px) scale(${gmailOpenScale})`,
            borderRadius: gmailOpenRadius,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <GmailInbox
            driveFrame={local - gmailFadeStart}
            fps={fps}
            width={width}
            height={height}
            scale={scale}
            opacity={gmailOpacity}
            replyAllScale={replyAllScale}
            replySentOpacity={replySentOpacity}
          />
        </div>
      )}

      {/* Google Docs — opens after Gmail exits. iOS app-open zoom
          anchored to the UPPER-CENTER (final unique home-screen
          origin). Tap-pulse on Turn in + "Homework submitted"
          confirmation. */}
      {docsOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width,
            height,
            transformOrigin: `${width * 0.5}px ${height * 0.18}px`,
            transform: `translateY(${docsExitDriftY}px) scale(${docsOpenScale})`,
            borderRadius: docsOpenRadius,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <GoogleDocs
            driveFrame={local - docsFadeStart}
            fps={fps}
            width={width}
            height={height}
            scale={scale}
            opacity={docsOpacity}
            turnInScale={turnInScale}
            submitConfirmOpacity={submitConfirmOpacity}
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
          opacity: priorBubblesOpacity,
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
        <div style={{ ...receiptStyle, opacity: deliveredFinalOpacity * priorBubblesOpacity }}>
          Delivered
        </div>
      )}
      {/* "Read" — fades in as "Delivered" fades out. */}
      {readOpacity > 0 && (
        <div style={{ ...receiptStyle, opacity: readOpacity * priorBubblesOpacity }}>Read</div>
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
            opacity: receivedOpacity * priorBubblesOpacity,
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
              opacity: sent2Opacity * priorBubblesOpacity,
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
                opacity: sent2DeliveredOpacity * priorBubblesOpacity,
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
                opacity: sent2ReadOpacity * priorBubblesOpacity,
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
            opacity: typing2Opacity * priorBubblesOpacity,
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
            opacity: received3Opacity * priorBubblesOpacity,
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

      {/* Sent bubble #3 — closing punchline. Centered on screen
          (both axes) and scaled up dramatically (~1.7×) so it
          dominates the frame as the focal-point closer. The other
          bubbles are already faded out by the time this lands. */}
      {sent3Opacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: width / 2,
            top: height / 2,
            transform: `translate(-50%, -50%) scale(${sent3Scale})`,
            opacity: sent3Opacity,
          }}
        >
          <MessageBubble
            width={sent3Width}
            height={sent3Height}
            cornerRadius={sent3CornerRadius}
            tailExt={sent3TailExt}
            tailHook={sent3TailHook}
            tailScaleX={1}
            tailSide="right"
            bubbleColor={IMESSAGE_BLUE}
            textColor="#FFFFFF"
            fontSize={sent3FontSize}
            paddingX={sent3PadX}
            letterSpacing={-0.3 * scale}
            // During the edit, text is dynamic (backspace → empty →
            // retype). Otherwise it's the static initial phrase.
            text={sent3VisibleText}
            // White cursor blinks during the edit window so the
            // bubble reads as actively being typed in.
            cursor={{
              visible: cursorVisibleSent3,
              color: "#FFFFFF",
              widthPx: 2 * scale,
            }}
            // Left-align the text during the edit so the cursor sits
            // at the natural end-of-text position; center it once
            // editing is done so the final phrase doesn't have
            // right-side slack.
            textAlign={editActive ? "start" : "center"}
            shadowOpacity={0.18}
            shadowBlur={20 * scale}
            shadowOffsetY={4 * scale}
            filterId="bubbleShadow-sent3"
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
                opacity: dwelledCellHighlightOpacity * priorBubblesOpacity,
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

      {/* Scene 3 — starts at 5s. Extended to 18.5s to fit the
          closing-punchline edit animation + the flight search
          background, tap on a flight, "Booking confirmed" toast,
          and the page exit. */}
      <Sequence from={sec(5, fps)} durationInFrames={sec(34, fps)}>
        <Scene3
          scale={scale}
          width={layoutWidth}
          height={layoutHeight}
        />
      </Sequence>

      {/* Caption 3 — overlaps with Caption 2 (text-only crossfade is fine).
          Fades out alongside the prior conversation just before the
          closing punchline ("bet, order some protection") enters, so
          sent #3 sits alone on screen as the focal point. */}
      <Sequence
        from={sec(5 - xfade, fps)}
        durationInFrames={sec(34 + xfade, fps)}
      >
        <Caption
          text="schedule a date with my crush"
          scale={scale}
          width={layoutWidth}
          height={layoutHeight}
          // sent3Start is at Scene 3 local 13.8s = video 18.8s.
          // Caption local time = video time - (5 - xfade) = video - 4.65s.
          // priorFadeStart = sent3Start - 0.3s → caption-local 13.85s.
          fadeOutAtSec={13.85}
          durationSec={14.1}
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
