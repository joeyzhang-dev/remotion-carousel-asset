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

const sec = (s: number, fps: number) => Math.round(s * fps);

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

  // SF Pro Display at weight 500: lowercase letter widths average ~0.52em,
  // narrow letters (i, l, t, f, r) ~0.30em, wide letters (m, w) ~0.82em,
  // spaces ~0.28em. Across typical English copy this works out to roughly
  // 0.48em per character. We bias slightly upward to 0.50 so the bubble
  // never clips the text — better to have a hair of right-padding than to
  // chop a glyph mid-render. (Ruler-based DOM measurement is unreliable
  // in Remotion's per-frame headless render, so we use a constant tuned
  // against the actual font.)
  const charWidthEm = 0.44;
  const bubbleFontShrink = 0.78;
  const bubbleFontSize = fontSize * bubbleFontShrink;
  const bubbleTextWidth = phrase.length * bubbleFontSize * charWidthEm;
  const bubblePadX = 32 * scale;
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
  // Tail "extrudes" from the bubble's right edge as the morph progresses.
  // We don't fade the tail's opacity — that would make it look semi-
  // transparent against the bubble's solid fill while they're different
  // colors. Instead we (a) animate a horizontal scale on the SVG with the
  // origin at the bubble's right edge, so the tail grows outward like
  // it's being pulled out of the bubble, and (b) tie the tail's fill
  // color to the bubble's animated background, so they're always the same
  // shade and read as one shape.
  //
  // Easing: a slight back-overshoot on the reveal gives the tail a
  // physical "pop out" feel matching iMessage's send animation.
  const tailRevealStart = 0.72;
  const tailRevealEnd = 1.0;
  const tailRevealP = interpolate(
    morphP,
    [tailRevealStart, tailRevealEnd],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.back(1.6)),
    },
  );
  // "Delivered" indicator fades in slightly after the bubble settles.
  const deliveredOpacity = interpolate(
    local,
    [holdStart + sec(0.1, fps), holdStart + sec(0.35, fps)],
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

  // Tail proportions — the iMessage outbound tail is a hooked nub at the
  // bubble's bottom-right corner. We render the tail as an SVG that
  // *overlaps* the bubble both horizontally (extending into the bubble by
  // 1.4× corner-radius) and vertically (extending up into the straight
  // portion of the bubble's right edge by 0.4× corner-radius). The deep
  // overlap (a) hides the seam between the bubble's rounded corner and
  // the tail's edge — sub-pixel rounding differences won't show because
  // we're well inside the bubble — and (b) lets the top of the tail's
  // concave hook merge smoothly into the bubble's straight right edge
  // instead of kinking at the corner-curve start point.
  const bubbleCornerRadius = animatedHeight * 0.42;
  const visibleTailW = bubbleCornerRadius * 0.85;
  const tailOverlapX = bubbleCornerRadius * 1.4;
  const tailOverlapY = bubbleCornerRadius * 0.4;
  const tailSvgW = tailOverlapX + visibleTailW;
  const tailH = bubbleCornerRadius + tailOverlapY;

  return (
    <AbsoluteFill style={{ opacity: envOpacity }}>
      <div
        style={{
          position: "absolute",
          left: width / 2 + rowXOffset,
          top: height * 0.5 + rowYOffset,
          transform: `translate(-50%, -50%) scale(${scaleEnv * bubbleScale})`,
          display: "flex",
          alignItems: "center",
          gap: 16 * scale * (1 - morphP),
        }}
      >
        {/* The chat field morphs into the iMessage bubble in place. */}
        <div
          style={{
            position: "relative",
            width: fieldWidth,
            height: animatedHeight,
            // borderRadius shrinks slightly during morph: the input is a full
            // pill (radius = height/2), but the iMessage bubble has a tighter
            // radius so the right edge has a flat section for the tail to
            // attach to.
            borderRadius: interpolate(
              morphP,
              [0, 1],
              [inputHeight / 2, animatedHeight * 0.42],
            ),
            background: fieldBg,
            display: "flex",
            alignItems: "center",
            paddingLeft: fieldPadX,
            paddingRight: fieldPadX,
            fontFamily: FONT_STACK,
            fontSize: animatedFontSize,
            color: textColor,
            fontWeight: 500,
            letterSpacing: -0.3 * scale,
            whiteSpace: "nowrap",
            boxShadow: `0 ${4 * scale}px ${20 * scale}px rgba(0,0,0,${bubbleShadow})`,
          }}
        >
          {/* iMessage outbound tail.

              Rendered FIRST in DOM order (before the text spans) so the
              text paints ON TOP of any tail pixels that overlap the
              bubble interior. Without this ordering, the tail's left
              edge — which extends `tailOverlapX` into the bubble — could
              cover characters near the right edge of the text.

              The SVG overlaps the bubble both horizontally (`tailOverlapX`
              into the bubble) and vertically (`tailOverlapY` above the
              corner-curve start), so the tail and bubble merge into a
              single visual blob with no visible seam.

              Path coords are in screen-pixel units (viewBox matches SVG
              size). Origin (0,0) = top-left of SVG (inside the bubble).
              Bubble's right edge in SVG coords is at x = tailOverlapX.
              Bubble's bottom is at y = tailH. */}
          <svg
            width={tailSvgW}
            height={tailH}
            viewBox={`0 0 ${tailSvgW} ${tailH}`}
            style={{
              position: "absolute",
              right: -visibleTailW,
              bottom: 0,
              overflow: "visible",
              // Reveal the tail by extruding it from the bubble's right edge.
              // transform-origin is placed exactly at the bubble's right
              // edge (in SVG-local coords at x = tailOverlapX), so scaleX
              // grows the visible tail outward while keeping the overlap
              // region (left of the origin) hidden behind the bubble.
              transform: `scaleX(${tailRevealP})`,
              transformOrigin: `${(tailOverlapX / tailSvgW) * 100}% center`,
            }}
          >
            <path
              d={`
                M 0 0
                L 0 ${tailH}
                L ${tailOverlapX + visibleTailW * 0.85} ${tailH}
                C ${tailOverlapX + visibleTailW * 0.5} ${tailH - bubbleCornerRadius * 0.2}
                  ${tailOverlapX} ${tailOverlapY + bubbleCornerRadius * 0.55}
                  ${tailOverlapX} ${tailOverlapY * 0.4}
                L ${tailOverlapX} 0
                Z
              `}
              fill={fieldBg}
            />
          </svg>
          {/* Text spans render AFTER the tail SVG so they paint on top.
              `position: relative` is required for `zIndex` to take effect
              and creates an explicit stacking context as a safety belt
              in case future siblings introduce stacking surprises. */}
          <span style={{ position: "relative", zIndex: 1 }}>{visible}</span>
          <span
            style={{
              display: "inline-block",
              width: 2 * scale,
              height: animatedFontSize * 1.05,
              marginLeft: 4 * scale,
              background: IMESSAGE_BLUE,
              opacity: cursorVisible && morphP === 0 ? 1 : 0,
              transform: "translateY(2px)",
              position: "relative",
              zIndex: 1,
            }}
          />
        </div>
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

      {/* "Delivered" indicator — sits below the settled bubble, right-aligned
          to the bubble's right edge to feel like a real iMessage timestamp. */}
      {deliveredOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: width / 2 + rowXOffset + bubbleWidth / 2 - 50 * scale,
            top: height * 0.5 + rowYOffset + bubbleHeight / 2 + 3 * scale,
            transform: "translateX(-100%)",
            fontFamily: FONT_STACK,
            fontSize: 22 * scale,
            color: "rgba(60, 60, 67, 0.6)",
            fontWeight: 500,
            letterSpacing: 0.3,
            opacity: deliveredOpacity,
          }}
        >
          Delivered
        </div>
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

      {/* Scene 3 — starts at 5s (after Scene 2's button has fully faded out)
          for the same reason as Scene 2: avoid stacked send buttons. */}
      <Sequence from={sec(5, fps)} durationInFrames={sec(3, fps)}>
        <Scene3
          scale={scale}
          width={layoutWidth}
          height={layoutHeight}
        />
      </Sequence>

      {/* Caption 3 — overlaps with Caption 2 (text-only crossfade is fine) */}
      <Sequence
        from={sec(5 - xfade, fps)}
        durationInFrames={sec(3 + xfade, fps)}
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
