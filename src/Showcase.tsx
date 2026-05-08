import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Helvetica, Arial, sans-serif";
const IMESSAGE_BLUE = "#007AFF";

const sec = (s: number, fps: number) => Math.round(s * fps);

// Crude per-character width estimate (em units) tuned for SF Pro
// Display at weight 500. Good enough for sizing a single short bubble.
const measureTextEm = (text: string): number => {
  let total = 0;
  for (const ch of text) {
    if (ch === " ") total += 0.28;
    else if ("ijlt!.,;:'`".includes(ch)) total += 0.32;
    else if ("fr".includes(ch)) total += 0.38;
    else if ("MWmw".includes(ch)) total += 0.92;
    else total += 0.56;
  }
  return total;
};

export const Showcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const scale = width / 1080;

  const phrase = "suck my cock";

  // Typewriter timing.
  const typeStart = sec(0.4, fps);
  const typeCharsPerSec = 16;
  const visibleCount =
    frame < typeStart
      ? 0
      : Math.min(
          phrase.length,
          Math.floor(((frame - typeStart) / fps) * typeCharsPerSec),
        );
  const visible = phrase.slice(0, visibleCount);
  const isTyping = visibleCount < phrase.length;

  // Cursor blink — 2Hz.
  const blinkPeriod = sec(0.5, fps);
  const cursorOn = Math.floor(frame / blinkPeriod) % 2 === 0;
  // Cursor only visible while still typing or at the end before send.
  const showCursor = frame >= typeStart && cursorOn;

  // Bubble sizing — measured against typed text so it grows as you type.
  const fontSize = 56 * scale;
  const padX = 28 * scale;
  const padY = 18 * scale;
  // Floor at a small width so the bubble has a visible shape before the
  // first character lands.
  const measured = measureTextEm(visible || "M") * fontSize;
  const bubbleWidth = measured + padX * 2 + (showCursor ? 6 * scale : 0);
  const bubbleHeight = fontSize * 1.4 + padY * 2;
  const cornerRadius = bubbleHeight / 2;

  // Pop-in scale on the bubble itself (subtle, keeps everything feeling alive).
  const bubbleScale = interpolate(
    frame,
    [typeStart - sec(0.2, fps), typeStart],
    [0.9, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );

  // Bubble tail geometry — a tiny iMessage-style hook on the right.
  const tailExt = 16 * scale;
  const tailHook = 12 * scale;

  return (
    <AbsoluteFill style={{ background: "#FFFFFF" }}>
      <div
        style={{
          position: "absolute",
          left: width / 2,
          top: height / 2,
          transform: `translate(-50%, -50%) scale(${bubbleScale})`,
          transformOrigin: "center center",
        }}
      >
        <div
          style={{
            position: "relative",
            width: bubbleWidth,
            height: bubbleHeight,
          }}
        >
          {/* Bubble + tail as a single SVG path so they share fill */}
          <svg
            width={bubbleWidth + tailExt + 30 * scale}
            height={bubbleHeight + 20 * scale}
            viewBox={`0 0 ${bubbleWidth + tailExt + 30 * scale} ${bubbleHeight + 20 * scale}`}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              overflow: "visible",
              pointerEvents: "none",
              filter: `drop-shadow(0 ${4 * scale}px ${20 * scale}px rgba(0,0,0,0.15))`,
            }}
          >
            <path
              d={buildBubblePath(
                bubbleWidth,
                bubbleHeight,
                cornerRadius,
                tailExt,
                tailHook,
              )}
              fill={IMESSAGE_BLUE}
            />
          </svg>
          {/* Text inside the bubble */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: bubbleWidth,
              height: bubbleHeight,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              paddingLeft: padX,
              paddingRight: padX,
              fontFamily: FONT_STACK,
              fontSize,
              fontWeight: 500,
              color: "#FFFFFF",
              letterSpacing: -0.3 * scale,
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            <span>{visible}</span>
            {(isTyping || frame < typeStart + sec(phrase.length / typeCharsPerSec + 1.0, fps)) && (
              <span
                style={{
                  display: "inline-block",
                  width: 3 * scale,
                  height: fontSize * 1.05,
                  marginLeft: 4 * scale,
                  background: "#FFFFFF",
                  opacity: showCursor ? 1 : 0,
                  transform: "translateY(2px)",
                }}
              />
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Builds an iMessage-style rounded bubble with a tail on the right side.
const buildBubblePath = (
  w: number,
  h: number,
  cr: number,
  ext: number,
  hookH: number,
): string => {
  // Origin (0,0) is the top-left of the bubble's body. The tail extends
  // past the right edge.
  const x0 = 0;
  const y0 = 0;
  const xR = w;
  const yB = h;

  // Walk: top-left → top-right (with corners) → tail → bottom-left
  return [
    `M ${x0 + cr} ${y0}`,
    `H ${xR - cr}`,
    `Q ${xR} ${y0} ${xR} ${y0 + cr}`,
    `V ${yB - cr}`,
    // Bottom-right corner blends into the tail
    `Q ${xR} ${yB} ${xR + ext * 0.4} ${yB - cr * 0.2}`,
    // Tail tip
    `Q ${xR + ext} ${yB + hookH * 0.2} ${xR + ext * 0.6} ${yB + hookH}`,
    // Tail returns to the bottom edge
    `Q ${xR - cr * 0.6} ${yB} ${xR - cr * 1.2} ${yB}`,
    `H ${x0 + cr}`,
    `Q ${x0} ${yB} ${x0} ${yB - cr}`,
    `V ${y0 + cr}`,
    `Q ${x0} ${y0} ${x0 + cr} ${y0}`,
    `Z`,
  ].join(" ");
};
