import "./index.css";
import { Composition } from "remotion";
import { AppCarousel } from "./AppCarousel";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="AppCarousel"
      component={AppCarousel}
      durationInFrames={600}
      fps={60}
      width={1080}
      height={1920}
    />
  );
};
