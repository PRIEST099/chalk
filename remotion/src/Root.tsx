import "./index.css";
import { ChalkComposition } from "./Composition";
import { HeroGifComposition } from "./HeroGif";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <ChalkComposition />
      <HeroGifComposition />
    </>
  );
};
