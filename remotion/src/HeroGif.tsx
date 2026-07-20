import { loadFont } from "@remotion/fonts";
import { Composition, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// Self-contained README hero composition. Deliberately imports nothing from the ChalkDemo
// setup (timeline/validate/ChalkDemo) so the demo video pipeline stays untouched.
// Three beats: voice draws a history timeline -> gestures select and connect -> lesson artifacts.

const fontFamily = "Space Grotesk";
void loadFont({ family: fontFamily, url: staticFile("fonts/space-grotesk-latin.woff2"), weight: "300 700" }).catch((error) => console.error("Font failed to load", error));

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const DURATION_FRAMES = 312;

const chalk = "#f5f0df";
const amber = "#e6a75b";
const slate = "#111b1d";

const seeded = (seed: number) => { const value = Math.sin(seed * 12.9898) * 43758.5453; return value - Math.floor(value); };

type HeroNode = { id: string; label: string; glyph: string; color: string; x: number; y: number; atSec: number };
type HeroEdge = { from: string; to: string; label: string; atSec: number; bow: number };
type HeroCaption = { text: string; atSec: number; spoken?: boolean; emphasis?: boolean };

const NODES: readonly HeroNode[] = [
  { id: "start", label: "1914 — War begins", glyph: "◇", color: "#77b78c", x: 420, y: 500, atSec: 0.7 },
  { id: "alliances", label: "Alliance system", glyph: "◉", color: "#e6a75b", x: 880, y: 500, atSec: 1.5 },
  { id: "armistice", label: "1918 — Armistice", glyph: "◇", color: "#7ab8c4", x: 1330, y: 500, atSec: 2.4 },
  { id: "treaty", label: "Treaty of Versailles", glyph: "✎", color: "#d7828b", x: 1330, y: 760, atSec: 3.1 },
];
const EDGES: readonly HeroEdge[] = [
  { from: "start", to: "alliances", label: "Draws in Europe", atSec: 1.9, bow: -120 },
  { from: "alliances", to: "armistice", label: "Until", atSec: 2.7, bow: -120 },
  { from: "armistice", to: "treaty", label: "Ends with", atSec: 3.4, bow: 40 },
  { from: "alliances", to: "treaty", label: "Redrawn by", atSec: 5.95, bow: 90 },
];
// The gesture beat: the amber hand cursor visits two nodes, pinches each, then the spoken
// command connects them — the multimodal moment from the live app.
const CURSOR = { appearSec: 4.0, reachFirstSec: 4.6, pinchFirstSec: 4.9, reachSecondSec: 5.4, pinchSecondSec: 5.7, fadeSec: 6.6 };
const ARTIFACTS_SEC = 6.9;
const FINALE_SEC = 9.2;
const CAPTIONS: readonly HeroCaption[] = [
  { text: "World War One began in 1914…", atSec: 0.3 },
  { text: "…the alliance system drew Europe in.", atSec: 1.6 },
  { text: "Speak — the board maps any lesson.", atSec: 3.0 },
  { text: "“Connect these two.”", atSec: 4.4, spoken: true },
  { text: "Replay it. Hand it out. Keep it.", atSec: ARTIFACTS_SEC },
  { text: "You talk. The board draws.", atSec: FINALE_SEC, emphasis: true },
];

const nodeById = new Map(NODES.map((node) => [node.id, node]));

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const sweepX = interpolate(frame % DURATION_FRAMES, [0, DURATION_FRAMES], [15, 85]);
  return <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 18% 10%, #263e3b 0%, ${slate} 44%, #0c1416 100%)` }}>
    <div style={{ position: "absolute", inset: "-20%", background: `radial-gradient(40% 48% at ${sweepX}% 14%, rgba(230,167,91,0.07), transparent 70%)` }} />
    {Array.from({ length: 16 }, (_, index) => {
      const baseX = seeded(index + 1) * 100;
      const y = (seeded(index + 7) * 100 + frame * (0.12 + seeded(index + 3) * 0.3)) % 116 - 8;
      const size = 1.5 + seeded(index + 5) * 2.5;
      const twinkle = 0.1 + 0.14 * (0.5 + Math.sin(frame / 24 + index) / 2);
      return <div key={index} style={{ position: "absolute", left: `${baseX}%`, top: `${y}%`, width: size, height: size, borderRadius: "50%", background: chalk, opacity: twinkle, filter: "blur(0.4px)" }} />;
    })}
    <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 320px rgba(0,0,0,0.55)" }} />
  </div>;
};

const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 200, stiffness: 110 } });
  return <div style={{ position: "absolute", left: 96, top: 84, opacity: progress, transform: `translateY(${interpolate(progress, [0, 1], [16, 0])}px)` }}>
    <div style={{ color: amber, fontFamily, fontWeight: 700, fontSize: 26, letterSpacing: 5 }}>CHALK</div>
    <div style={{ color: chalk, fontFamily, fontWeight: 600, fontSize: 46, marginTop: 8 }}>The board that draws itself</div>
    <div style={{ height: 3, marginTop: 14, width: interpolate(progress, [0, 1], [0, 150]), background: `linear-gradient(90deg, ${amber}, rgba(230,167,91,0))`, borderRadius: 2 }} />
  </div>;
};

const edgePath = (edge: HeroEdge) => {
  const from = nodeById.get(edge.from)!;
  const to = nodeById.get(edge.to)!;
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(Math.hypot(dx, dy), 1);
  const control = { x: mid.x + (-dy / length) * edge.bow, y: mid.y + (dx / length) * edge.bow };
  // Labels sit past the curve's apex, away from the wide node cards on either side.
  const labelPoint = { x: mid.x + (-dy / length) * edge.bow * 0.9, y: mid.y + (dx / length) * edge.bow * 0.9 };
  return { d: `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`, labelPoint };
};

const Edges: React.FC<{ contentOpacity: number }> = ({ contentOpacity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;
  return <>
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ position: "absolute", inset: 0, opacity: contentOpacity }}>
      {EDGES.map((edge) => {
        const draw = interpolate(seconds, [edge.atSec, edge.atSec + 0.6], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const glow = seconds >= FINALE_SEC ? 0.5 + 0.5 * (0.5 + Math.sin((seconds - FINALE_SEC) * 5) / 2) : 0;
        return <path key={`${edge.from}-${edge.to}`} d={edgePath(edge).d} pathLength={1} fill="none" stroke="#dce5df" strokeWidth={3 + glow * 1.2} strokeLinecap="round" strokeDasharray={1} strokeDashoffset={draw} opacity={0.9} />;
      })}
    </svg>
    {EDGES.map((edge) => {
      const appear = interpolate(seconds, [edge.atSec + 0.45, edge.atSec + 0.75], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      const { labelPoint } = edgePath(edge);
      return <div key={`label-${edge.from}-${edge.to}`} style={{ position: "absolute", left: labelPoint.x, top: labelPoint.y, transform: "translate(-50%, -50%)", opacity: appear * contentOpacity, background: "#142023", border: "1px solid rgba(245,240,223,0.14)", borderRadius: 7, color: "#fff8e7", fontFamily, fontSize: 21, fontWeight: 700, padding: "4px 12px" }}>{edge.label}</div>;
    })}
  </>;
};

const Nodes: React.FC<{ contentOpacity: number }> = ({ contentOpacity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;
  return <>{NODES.map((node, index) => {
    const entrance = spring({ frame: Math.max(0, frame - Math.round(node.atSec * fps)), fps, config: { damping: 16, stiffness: 160, mass: 0.8 } });
    if (entrance <= 0.001) return null;
    const pointed = (node.id === "alliances" && seconds >= CURSOR.reachFirstSec && seconds < CURSOR.fadeSec) || (node.id === "treaty" && seconds >= CURSOR.reachSecondSec && seconds < CURSOR.fadeSec);
    const selected = (node.id === "alliances" && seconds >= CURSOR.pinchFirstSec) || (node.id === "treaty" && seconds >= CURSOR.pinchSecondSec);
    const finalePulse = seconds >= FINALE_SEC ? Math.max(0, 0.5 + 0.5 * Math.sin((seconds - FINALE_SEC - index * 0.12) * 6)) : 0;
    const ring = pointed ? "0 0 0 5px rgba(243, 200, 135, 0.85)" : "";
    const glow = finalePulse > 0.05 ? `0 0 ${22 * finalePulse}px ${node.color}` : "";
    const boxShadow = [ring, glow].filter(Boolean).join(", ") || "0 14px 34px rgba(0,0,0,0.4)";
    return <div key={node.id} style={{ position: "absolute", left: node.x, top: node.y, transform: `translate(-50%, -50%) scale(${interpolate(entrance, [0, 1], [0.7, 1])})`, opacity: Math.min(entrance * 1.4, 1) * contentOpacity, filter: `blur(${interpolate(entrance, [0, 1], [8, 0])}px)` }}>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, background: selected ? `${node.color}33` : "#1d2d2e", border: `3px solid ${node.color}`, borderRadius: 16, padding: "16px 26px", color: chalk, fontFamily, boxShadow }}>
        <span style={{ fontSize: 20, color: node.color }}>{node.glyph}</span>
        <strong style={{ fontSize: 30, fontWeight: 600, whiteSpace: "nowrap" }}>{node.label}</strong>
        {selected && <span style={{ position: "absolute", right: -13, top: -13, display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: "50%", background: chalk, color: "#172326", fontSize: 19, fontWeight: 800 }}>✓</span>}
      </div>
    </div>;
  })}</>;
};

// The app's amber gesture cursor gliding between the two nodes it pinch-selects.
const GestureCursor: React.FC<{ contentOpacity: number }> = ({ contentOpacity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;
  if (seconds < CURSOR.appearSec || seconds > CURSOR.fadeSec) return null;
  const first = nodeById.get("alliances")!;
  const second = nodeById.get("treaty")!;
  const x = interpolate(seconds, [CURSOR.appearSec, CURSOR.reachFirstSec, CURSOR.pinchFirstSec, CURSOR.reachSecondSec], [first.x - 320, first.x, first.x, second.x], { extrapolateRight: "clamp" });
  const y = interpolate(seconds, [CURSOR.appearSec, CURSOR.reachFirstSec, CURSOR.pinchFirstSec, CURSOR.reachSecondSec], [first.y + 260, first.y + 40, first.y + 40, second.y + 42], { extrapolateRight: "clamp" });
  const pinchPop = Math.max(
    interpolate(seconds, [CURSOR.pinchFirstSec - 0.12, CURSOR.pinchFirstSec, CURSOR.pinchFirstSec + 0.25], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(seconds, [CURSOR.pinchSecondSec - 0.12, CURSOR.pinchSecondSec, CURSOR.pinchSecondSec + 0.25], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
  const fade = Math.min(interpolate(seconds, [CURSOR.appearSec, CURSOR.appearSec + 0.3], [0, 1], { extrapolateRight: "clamp" }), interpolate(seconds, [CURSOR.fadeSec - 0.3, CURSOR.fadeSec], [1, 0], { extrapolateLeft: "clamp" }));
  return <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${1 - pinchPop * 0.35})`, opacity: fade * contentOpacity }}>
    <div style={{ width: 26, height: 26, borderRadius: "50%", border: `3px solid ${amber}`, background: "rgba(230,167,91,0.3)", boxShadow: `0 0 ${14 + pinchPop * 18}px rgba(230,167,91,0.7)` }} />
  </div>;
};

// Beat three: the lesson leaves the room as durable artifacts.
const ArtifactsCard: React.FC<{ contentOpacity: number }> = ({ contentOpacity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: Math.max(0, frame - Math.round(ARTIFACTS_SEC * fps)), fps, config: { damping: 24, stiffness: 130 } });
  if (progress <= 0.001) return null;
  const skeleton = (width: number, delay: number) => <div style={{ height: 12, width: interpolate(spring({ frame: Math.max(0, frame - Math.round((ARTIFACTS_SEC + delay) * fps)), fps, config: { damping: 200 } }), [0, 1], [0, width]), borderRadius: 6, background: "rgba(245,240,223,0.22)" }} />;
  return <div style={{ position: "absolute", left: 320, top: 330, transform: `translateY(${interpolate(progress, [0, 1], [40, 0])}px) rotate(-3deg)`, opacity: progress * contentOpacity }}>
    <div style={{ width: 330, borderRadius: 18, background: "#f7f3e6", boxShadow: "0 30px 70px rgba(0,0,0,0.5)", padding: "24px 26px", fontFamily }}>
      <div style={{ color: "#172326", fontWeight: 700, fontSize: 22 }}>Class handout</div>
      <div style={{ color: "#5c6660", fontSize: 15, marginTop: 2 }}>Recap · Glossary · 3 questions</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 16 }}>
        <div style={{ height: 12, width: interpolate(progress, [0, 1], [0, 270]), borderRadius: 6, background: "rgba(23,35,38,0.25)" }} />
        {skeleton(240, 0.15)}
        {skeleton(255, 0.3)}
        {skeleton(180, 0.45)}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        {["Replay", "PNG", "Handout"].map((chip, index) => <span key={chip} style={{ borderRadius: 999, border: "1.5px solid rgba(23,35,38,0.3)", color: "#172326", fontSize: 14, fontWeight: 600, padding: "4px 12px", opacity: interpolate(spring({ frame: Math.max(0, frame - Math.round((ARTIFACTS_SEC + 0.35 + index * 0.15) * fps)), fps, config: { damping: 200 } }), [0, 1], [0, 1]) }}>{chip}</span>)}
      </div>
    </div>
  </div>;
};

const CaptionBar: React.FC<{ contentOpacity: number }> = ({ contentOpacity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;
  let index = -1;
  for (let i = 0; i < CAPTIONS.length; i += 1) if (seconds >= CAPTIONS[i].atSec) index = i;
  if (index === -1) return null;
  const caption = CAPTIONS[index];
  const words = caption.text.split(" ");
  const shown = Math.min(words.length, Math.floor((seconds - caption.atSec) / 0.09) + 1);
  const pulse = 0.55 + 0.45 * (0.5 + Math.sin(frame / 6) / 2);
  return <div style={{ position: "absolute", left: 0, right: 0, bottom: 64, display: "flex", justifyContent: "center", opacity: contentOpacity }}>
    <div style={{ display: "flex", alignItems: "center", gap: 18, background: "rgba(12,20,22,0.92)", border: "1px solid rgba(230,167,91,0.25)", borderRadius: 18, boxShadow: "0 14px 40px rgba(0,0,0,0.45)", padding: "18px 30px" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 9, color: "#7ee2a8", fontFamily, fontSize: 20, fontWeight: 600 }}><span style={{ width: 12, height: 12, borderRadius: "50%", background: "#4ade80", boxShadow: `0 0 ${10 * pulse}px rgba(74,222,128,0.9)` }} />Listening</span>
      <span style={{ width: 1, height: 26, background: "rgba(245,240,223,0.18)" }} />
      <span style={{ color: caption.emphasis ? amber : chalk, fontFamily, fontSize: 32, fontWeight: caption.emphasis ? 700 : 500, fontStyle: caption.spoken ? "italic" : "normal" }}>{words.slice(0, shown).join(" ")}</span>
    </div>
  </div>;
};

export const HeroGif: React.FC = () => {
  const frame = useCurrentFrame();
  // The board wipes clean at the end so the GIF loops as a fresh lesson starting over.
  const contentOpacity = interpolate(frame, [DURATION_FRAMES - 16, DURATION_FRAMES - 2], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <div style={{ width: "100%", height: "100%", overflow: "hidden", background: slate }}>
    <Background />
    <Edges contentOpacity={contentOpacity} />
    <Nodes contentOpacity={contentOpacity} />
    <GestureCursor contentOpacity={contentOpacity} />
    <ArtifactsCard contentOpacity={contentOpacity} />
    <Title />
    <CaptionBar contentOpacity={contentOpacity} />
  </div>;
};

export const HeroGifComposition: React.FC = () => <Composition id="HeroGif" component={HeroGif} durationInFrames={DURATION_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />;
