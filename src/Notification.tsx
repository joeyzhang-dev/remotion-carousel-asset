import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  spring,
} from "remotion";

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Helvetica, Arial, sans-serif";

const sec = (s: number, fps: number) => Math.round(s * fps);

export const Notification: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const scale = width / 1080;

  // Banner drop-in from above with a soft spring settle.
  const dropSpring = spring({
    frame: frame - sec(0.3, fps),
    fps,
    config: { damping: 14, stiffness: 140, mass: 0.7 },
  });
  const bannerOpacity = interpolate(
    frame,
    [sec(0.3, fps), sec(0.5, fps)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );
  const bannerY = interpolate(dropSpring, [0, 1], [-height * 0.2, 0]);

  // Card geometry (matches iOS notification proportions).
  const cardW = width * 0.92;
  const cardRadius = 36 * scale;
  const cardPadX = 36 * scale;
  const cardPadY = 28 * scale;
  const iconSize = 60 * scale;
  const iconRadius = 14 * scale;

  return (
    <AbsoluteFill style={{ background: "transparent" }}>
      <div
        style={{
          position: "absolute",
          left: (width - cardW) / 2,
          top: height * 0.08,
          width: cardW,
          opacity: bannerOpacity,
          transform: `translateY(${bannerY}px)`,
        }}
      >
        <div
          style={{
            width: cardW,
            borderRadius: cardRadius,
            background: "rgba(255, 255, 255, 0.92)",
            backdropFilter: `blur(${30 * scale}px) saturate(180%)`,
            WebkitBackdropFilter: `blur(${30 * scale}px) saturate(180%)`,
            border: `${1.5 * scale}px solid rgba(255, 255, 255, 0.55)`,
            boxShadow: `
              0 ${20 * scale}px ${50 * scale}px rgba(0, 0, 0, 0.35),
              0 ${4 * scale}px ${12 * scale}px rgba(0, 0, 0, 0.18),
              inset 0 ${1.5 * scale}px 0 rgba(255, 255, 255, 0.95)
            `,
            paddingLeft: cardPadX,
            paddingRight: cardPadX,
            paddingTop: cardPadY,
            paddingBottom: cardPadY,
            fontFamily: FONT_STACK,
          }}
        >
          {/* Top row — app icon + MESSAGES caption + "now" */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14 * scale,
            }}
          >
            {/* iMessage app icon — green rounded square w/ white speech bubble */}
            <div
              style={{
                width: iconSize,
                height: iconSize,
                borderRadius: iconRadius,
                background:
                  "linear-gradient(180deg, #5DEA68 0%, #2BC845 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 ${1 * scale}px ${2 * scale}px rgba(0,0,0,0.18)`,
                flexShrink: 0,
              }}
            >
              <svg
                width={iconSize * 0.62}
                height={iconSize * 0.62}
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M12 3 C6.5 3 2 6.7 2 11.4 C2 14.1 3.6 16.5 6 18 L4.8 21 L8.6 19.5 C9.7 19.8 10.8 20 12 20 C17.5 20 22 16.3 22 11.4 C22 6.7 17.5 3 12 3 Z"
                  fill="#FFFFFF"
                />
              </svg>
            </div>
            <div
              style={{
                fontSize: 26 * scale,
                fontWeight: 600,
                color: "#3C3C43",
                letterSpacing: 1.2 * scale,
                textTransform: "uppercase",
                opacity: 0.85,
                flex: 1,
              }}
            >
              Messages
            </div>
            <div
              style={{
                fontSize: 24 * scale,
                fontWeight: 400,
                color: "#3C3C43",
                opacity: 0.55,
              }}
            >
              now
            </div>
          </div>
          {/* Sender + subtitle */}
          <div style={{ marginTop: 14 * scale }}>
            <div
              style={{
                fontSize: 38 * scale,
                fontWeight: 700,
                color: "#000000",
                letterSpacing: -0.5 * scale,
                lineHeight: 1.2,
              }}
            >
              Folk
            </div>
            <div
              style={{
                fontSize: 30 * scale,
                fontWeight: 400,
                color: "#1C1C1E",
                marginTop: 4 * scale,
                lineHeight: 1.3,
              }}
            >
              Hey Elsa is ready for your date!
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

