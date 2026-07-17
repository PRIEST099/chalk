import { loadFont } from "@remotion/fonts";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Audio, interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CARD_SECOND_LINE_DELAY_SEC, FPS, LIVE_URL, NARRATION_DUCK_VOLUME, segmentDurationInFrames, TITLE_TREATMENT_SEC, TRANSITION_FRAMES, type CardSegment, type RecordingSegment, type Segment, type SubtitleCue, timeline } from "./timeline";
import { availableAudioFiles, availableRecordingFiles } from "./generated-media";

const fontFamily = "Space Grotesk";
// loadFont blocks the render until the woff2 is ready, so no frame is captured with a fallback font.
void loadFont({ family: fontFamily, url: staticFile("fonts/space-grotesk-latin.woff2"), weight: "300 700" }).catch((error) => console.error("Font failed to load", error));

const chalk = "#f5f0df";
const amber = "#e6a75b";
const slate = "#111b1d";
const muted = "#b9c6c0";

const SUBTITLE_FADE_SEC = 0.25;
const displayUrl = LIVE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

// Deterministic per-seed value in [0,1); Math.sin is allowed in Remotion (unlike Math.random/Date).
const seeded = (seed: number) => { const value = Math.sin(seed * 12.9898) * 43758.5453; return value - Math.floor(value); };

// Frame geometry: "wide" centers the browser frame with a subtitle band below; "hero" pairs a
// smaller frame on the right with the title block on the left (used by the hook).
const CHROME_BAR_PX = 44;
// Wide bottom edge lands at 923px, clearing a two-line subtitle band (top edge ~950px).
const frameRects = {
  wide: { left: 200, top: 24, width: 1520 },
  hero: { left: 640, top: 168, width: 1216 },
} as const;
const frameHeight = (width: number) => CHROME_BAR_PX + Math.round((width * 9) / 16);
const trafficLights = ["rgba(224, 108, 117, 0.55)", "rgba(229, 192, 123, 0.55)", "rgba(138, 190, 140, 0.55)"];

const DustField: React.FC = () => {
  const frame = useCurrentFrame();
  // A slow light sweep drifts across the board for depth; kept low-contrast so it never distracts.
  const sweepX = interpolate(frame % 420, [0, 420], [8, 92]);
  return <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
    <div style={{ position: "absolute", inset: "-20%", background: `radial-gradient(38% 46% at ${sweepX}% 12%, rgba(230,167,91,0.08), transparent 70%)` }} />
    {Array.from({ length: 20 }, (_, index) => {
      const baseX = seeded(index + 1) * 100;
      const baseY = seeded(index + 7) * 100;
      const speed = 0.15 + seeded(index + 3) * 0.35;
      const drift = (frame * speed) % 130;
      const y = (baseY + drift) % 118 - 9;
      const size = 1.5 + seeded(index + 5) * 2.5;
      const twinkle = 0.12 + 0.16 * (0.5 + Math.sin(frame / 22 + index) / 2);
      return <div key={index} style={{ position: "absolute", left: `${baseX}%`, top: `${y}%`, width: size, height: size, borderRadius: "50%", background: chalk, opacity: twinkle, filter: "blur(0.4px)" }} />;
    })}
    <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 320px rgba(0,0,0,0.55)" }} />
  </div>;
};

const Background: React.FC = () => <><div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 18% 10%, #263e3b 0%, ${slate} 44%, #0c1416 100%)` }} /><DustField /></>;

const Subtitles: React.FC<{ cues: readonly SubtitleCue[] }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;
  const index = cues.findIndex((candidate) => seconds >= candidate.startSec && seconds < candidate.endSec);
  if (index === -1) return null;
  const cue = cues[index];
  // Cues that abut the previous/next cue cut instead of fading, so continuous narration never blinks.
  const abutsPrevious = index > 0 && cue.startSec - cues[index - 1].endSec < SUBTITLE_FADE_SEC / 2;
  const abutsNext = index < cues.length - 1 && cues[index + 1].startSec - cue.endSec < SUBTITLE_FADE_SEC / 2;
  const fadeIn = abutsPrevious ? 1 : interpolate(seconds, [cue.startSec, cue.startSec + SUBTITLE_FADE_SEC], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = abutsNext ? 1 : interpolate(seconds, [cue.endSec - SUBTITLE_FADE_SEC, cue.endSec], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);
  const rise = interpolate(fadeIn, [0, 1], [14, 0]);
  const blur = interpolate(fadeIn, [0, 1], [6, 0]);
  return <div style={{ position: "absolute", left: 160, right: 160, bottom: 26, display: "flex", justifyContent: "center", opacity, transform: `translateY(${rise}px)`, filter: `blur(${blur}px)` }}><div style={{ maxWidth: 1440, borderRadius: 14, background: "rgba(12, 20, 22, 0.9)", border: "1px solid rgba(230, 167, 91, 0.22)", boxShadow: "0 12px 34px rgba(0,0,0,0.4)", color: chalk, fontFamily, fontSize: 30, fontWeight: 500, lineHeight: 1.3, padding: "13px 26px", textAlign: "center" }}>{cue.text}</div></div>;
};

const Slate: React.FC<{ segment: RecordingSegment }> = ({ segment }) => {
  const frame = useCurrentFrame();
  const pulse = 0.95 + Math.sin(frame / 18) * 0.02;
  return <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: slate, color: chalk, fontFamily }}><div style={{ width: "84%", border: "1px dashed rgba(230, 167, 91, 0.75)", borderRadius: 24, padding: "48px 56px", background: "#172326", transform: `scale(${pulse})` }}><div style={{ color: amber, fontSize: 20, fontWeight: 700, letterSpacing: 3, marginBottom: 18 }}>RECORDING PLACEHOLDER</div><div style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.15 }}>DROP {segment.file ?? "<expected-filename>.mp4"} INTO</div><div style={{ marginTop: 8, color: amber, fontSize: 40, fontWeight: 600 }}>public/recordings/</div><div style={{ marginTop: 32, display: "flex", gap: 16, fontSize: 22, color: muted }}><span>segment: {segment.id}</span><span>•</span><span>target: {segment.targetDurationSec}s</span><span>•</span><span>source: {segment.startFromSec}s–{segment.endAtSec}s</span></div></div></div>;
};

const BrowserFrame: React.FC<{ segment: RecordingSegment; ducked: boolean }> = ({ segment, ducked }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({ frame, fps, config: { damping: 200, stiffness: 110 } });
  const rect = frameRects[segment.frame];
  const hasFile = segment.file !== null && availableRecordingFiles.includes(segment.file);
  const lift = interpolate(entrance, [0, 1], [34, 0]);
  const scale = interpolate(entrance, [0, 1], [0.955, 1]);
  const blur = interpolate(entrance, [0, 1], [10, 0]);
  const float = Math.sin(frame / 42) * 4; // gentle continuous hover so the frame feels alive
  const glow = 0.32 + 0.1 * (0.5 + Math.sin(frame / 40) / 2);
  return <div style={{ position: "absolute", left: rect.left, top: rect.top, width: rect.width, height: frameHeight(rect.width), borderRadius: 20, overflow: "hidden", border: `1px solid rgba(230, 167, 91, ${glow})`, boxShadow: `0 40px 90px rgba(0,0,0,0.55), 0 0 60px rgba(230,167,91,${glow * 0.3})`, background: slate, opacity: entrance, transform: `translateY(${lift + float}px) scale(${scale})`, filter: `blur(${blur}px)` }}>
    <div style={{ height: CHROME_BAR_PX, display: "flex", alignItems: "center", gap: 10, padding: "0 20px", background: "#0c1416", borderBottom: "1px solid rgba(245, 240, 223, 0.08)" }}>
      <div style={{ display: "flex", gap: 7 }}>{trafficLights.map((color) => <span key={color} style={{ width: 11, height: 11, borderRadius: "50%", background: color }} />)}</div>
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}><span style={{ borderRadius: 8, background: "rgba(245, 240, 223, 0.07)", color: muted, fontFamily, fontSize: 17, padding: "4px 18px" }}>{displayUrl}</span></div>
      <div style={{ width: 47 }} />
    </div>
    <div style={{ position: "relative", width: "100%", height: `calc(100% - ${CHROME_BAR_PX}px)`, background: slate }}>
      {hasFile && segment.file !== null ? <OffthreadVideo src={staticFile(`recordings/${segment.file}`)} trimBefore={Math.round(segment.startFromSec * FPS)} trimAfter={Math.round(segment.endAtSec * FPS)} volume={segment.muted ? 0 : ducked ? NARRATION_DUCK_VOLUME : 1} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Slate segment={segment} />}
    </div>
  </div>;
};

// Blur-in + upward drift reveal shared by hero and card text, staggered by a per-line frame delay.
const Reveal: React.FC<{ delaySec: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ delaySec, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: Math.max(0, frame - delaySec * fps), fps, config: { damping: 200, stiffness: 120 } });
  return <div style={{ ...style, opacity: progress, transform: `translateY(${interpolate(progress, [0, 1], [20, 0])}px)`, filter: `blur(${interpolate(progress, [0, 1], [8, 0])}px)` }}>{children}</div>;
};

const HeroTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const underline = spring({ frame: Math.max(0, frame - TITLE_TREATMENT_SEC * fps * 0.4), fps, config: { damping: 200, stiffness: 90 } });
  return <div style={{ position: "absolute", left: 96, top: 0, bottom: 88, width: 480, display: "flex", flexDirection: "column", justifyContent: "center" }}>
    <Reveal delaySec={0}><div style={{ color: amber, fontFamily, fontWeight: 700, fontSize: 26, letterSpacing: 5 }}>CHALK</div></Reveal>
    <Reveal delaySec={0.18} style={{ marginTop: 14 }}><div style={{ color: chalk, fontFamily, fontWeight: 600, fontSize: 58, lineHeight: 1.12 }}>The board that draws itself</div></Reveal>
    <div style={{ height: 3, marginTop: 20, width: interpolate(underline, [0, 1], [0, 168]), background: `linear-gradient(90deg, ${amber}, rgba(230,167,91,0))`, borderRadius: 2 }} />
    <Reveal delaySec={0.42} style={{ marginTop: 20 }}><div style={{ color: muted, fontFamily, fontWeight: 500, fontSize: 24 }}>OpenAI Build Week 2026 — Education track</div></Reveal>
  </div>;
};

const Card: React.FC<{ segment: CardSegment }> = ({ segment }) => {
  const isEndCard = segment.id === "end-card";
  return <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 150, color: chalk, fontFamily, textAlign: "center" }}><div style={{ maxWidth: 1500 }}>
    <Reveal delaySec={0} style={{ marginBottom: 34 }}><div style={{ color: amber, fontWeight: 700, fontSize: isEndCard ? 32 : 26, letterSpacing: 4 }}>CHALK</div></Reveal>
    {segment.lines.map((line, index) => <Reveal key={line} delaySec={0.15 + index * CARD_SECOND_LINE_DELAY_SEC * 0.5} style={{ marginTop: index === 0 ? 0 : 26 }}><div style={{ color: index > 1 ? muted : chalk, fontSize: isEndCard ? (index === 0 ? 66 : 32) : 68, fontWeight: index === 0 ? 600 : 500, lineHeight: 1.18 }}>{line}</div></Reveal>)}
  </div></div>;
};

const SegmentView: React.FC<{ segment: Segment }> = ({ segment }) => {
  const narration = segment.narration !== null && availableAudioFiles.includes(segment.narration) ? segment.narration : null;
  return <><Background />{narration && <Audio src={staticFile(`audio/${narration}`)} />}{segment.type === "card" ? <Card segment={segment} /> : <BrowserFrame segment={segment} ducked={narration !== null} />}{segment.type === "recording" && segment.frame === "hero" && <HeroTitle />}<Subtitles cues={segment.subtitles} /></>;
};

// A gentle eased crossfade between every segment, overlapping them by TRANSITION_FRAMES.
const transitionTiming = springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION_FRAMES });

export const ChalkDemo: React.FC = () => <div style={{ width: "100%", height: "100%", overflow: "hidden", background: slate }}>
  <TransitionSeries>
    {timeline.flatMap((segment, index) => [
      ...(index > 0 ? [<TransitionSeries.Transition key={`${segment.id}-transition`} presentation={fade()} timing={transitionTiming} />] : []),
      <TransitionSeries.Sequence key={segment.id} durationInFrames={segmentDurationInFrames(segment)}><SegmentView segment={segment} /></TransitionSeries.Sequence>,
    ])}
  </TransitionSeries>
</div>;
