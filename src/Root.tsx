import "./index.css";
import { Composition } from "remotion";
import { AppCarousel } from "./AppCarousel";
import { AIOrgChart } from "./AIOrgChart";
import { MessagesAd, MessagesAdHorizontal } from "./MessagesAd";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AppCarousel"
        component={AppCarousel}
        durationInFrames={600}
        fps={60}
        width={1080}
        height={1920}
      />
      <Composition
        id="AIOrgChart"
        component={AIOrgChart}
        durationInFrames={150}
        fps={60}
        width={1080}
        height={1920}
      />

      {/* Vertical 9:16 — mobile-native. 24.5s total. */}
      <Composition
        id="preview"
        component={MessagesAd}
        durationInFrames={1020}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="master-4k"
        component={MessagesAd}
        durationInFrames={2040}
        fps={60}
        width={2160}
        height={3840}
      />

      {/* Horizontal 16:9 — content laid out inside a centered 9:16 mobile-safe
          region, so the same render works for desktop and (cropped) mobile.
          Safe-area gridline shows in the studio only by default. */}
      <Composition
        id="preview-16x9"
        component={MessagesAdHorizontal}
        durationInFrames={1020}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="master-16x9-4k"
        component={MessagesAdHorizontal}
        durationInFrames={2040}
        fps={60}
        width={3840}
        height={2160}
      />
    </>
  );
};
