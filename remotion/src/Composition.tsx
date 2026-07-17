import { Composition } from "remotion";
import { ChalkDemo } from "./ChalkDemo";
import { FPS, HEIGHT, totalDurationInFrames, WIDTH } from "./timeline";
import { validateTimeline } from "./validate";

validateTimeline();

export const ChalkComposition: React.FC = () => <Composition id="ChalkDemo" component={ChalkDemo} durationInFrames={totalDurationInFrames} fps={FPS} width={WIDTH} height={HEIGHT} />;
