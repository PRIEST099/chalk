export const WIDTH = 1920;
export const HEIGHT = 1080;
export const FPS = 30;
export const MAX_DURATION_SEC = 175;
export const TITLE_TREATMENT_SEC = 3;
export const CARD_SECOND_LINE_DELAY_SEC = 0.8;

export const LIVE_URL = "https://chalk-ebon.vercel.app/";
export const REPO_URL = "https://github.com/PRIEST099/chalk";

// How loudly a recording plays underneath its narration track (1 = full volume).
export const NARRATION_DUCK_VOLUME = 0.15;

/**
 * A timed subtitle line, in seconds relative to the segment start. The cues are also the
 * narration script: play the composition in Remotion Studio and read them while recording
 * each segment's voiceover file.
 */
export type SubtitleCue = { text: string; startSec: number; endSec: number };

type SegmentBase = {
  id: string;
  targetDurationSec: number;
  /** Voiceover file in public/audio/, or null when the recording's own audio carries the segment. */
  narration: string | null;
  subtitles: readonly SubtitleCue[];
};

export type CardSegment = SegmentBase & {
  type: "card";
  lines: readonly string[];
};

export type RecordingSegment = SegmentBase & {
  type: "recording";
  /** "wide" centers the framed recording; "hero" pairs a smaller frame with the title block. */
  frame: "wide" | "hero";
  file: string | null;
  startFromSec: number;
  endAtSec: number;
  muted: boolean;
};

export type Segment = CardSegment | RecordingSegment;

export const timeline: readonly Segment[] = [
  {
    id: "hook",
    type: "recording",
    targetDurationSec: 8,
    frame: "hero",
    narration: "vo-hook.mp3",
    subtitles: [
      { text: "When you teach, you can't talk and draw at the same time — especially over a video call.", startSec: 0.4, endSec: 4.6 },
      { text: "This is Chalk — a board that draws itself.", startSec: 4.6, endSec: 7.8 },
    ],
    file: "hook.mp4",
    startFromSec: 0,
    endAtSec: 8,
    // The hook reuses voice-build footage; its spoken lesson audio would clash with the hook narration.
    muted: true,
  },
  {
    id: "problem",
    type: "card",
    targetDurationSec: 6,
    narration: "vo-problem.mp3",
    subtitles: [
      { text: "So the board draws while you talk.", startSec: 0.4, endSec: 3.2 },
      { text: "Built for OpenAI Build Week — Education track.", startSec: 3.2, endSec: 5.8 },
    ],
    lines: ["When you teach, you can't talk and draw at the same time.", "So the board draws while you talk."],
  },
  {
    id: "voice-build",
    type: "recording",
    targetDurationSec: 55,
    frame: "wide",
    // The teacher speaking to the app IS this segment's narration — keep the live audio.
    narration: null,
    subtitles: [
      { text: "I just talk. GPT-5.6 listens and drafts the diagram in real time.", startSec: 0.5, endSec: 6.5 },
      { text: "It decides what deserves a node, how things connect, even the layout.", startSec: 6.5, endSec: 13 },
      { text: "It understands corrections…", startSec: 33, endSec: 39 },
      { text: "…and when I return to an idea, it highlights instead of duplicating.", startSec: 44, endSec: 51 },
    ],
    file: "segment-a-voice-build.mp4",
    startFromSec: 0,
    endAtSec: 55,
    muted: false,
  },
  {
    id: "gesture-title",
    type: "card",
    targetDurationSec: 4,
    narration: "vo-gesture-title.mp3",
    // The narration reads the card line itself; a duplicate subtitle would clutter the card.
    subtitles: [],
    lines: ["Your hands work with your voice."],
  },
  {
    id: "gestures",
    type: "recording",
    targetDurationSec: 30,
    frame: "wide",
    // "Connect these two" must stay audible — keep the live audio.
    narration: null,
    subtitles: [
      { text: "My hands work with my voice.", startSec: 0.5, endSec: 4.5 },
      { text: "I'm pointing at the board through my webcam.", startSec: 4.5, endSec: 11 },
      { text: "When I say \"these two,\" GPT-5.6 resolves it from what I've selected.", startSec: 11, endSec: 19 },
      { text: "Speech creates; gestures steer.", startSec: 19, endSec: 26 },
    ],
    file: "segment-b-gestures.mp4",
    startFromSec: 0,
    endAtSec: 30,
    muted: false,
  },
  {
    id: "artifacts",
    type: "recording",
    targetDurationSec: 25,
    frame: "wide",
    narration: "vo-artifacts.mp3",
    subtitles: [
      { text: "Every lesson becomes a durable artifact.", startSec: 0.4, endSec: 4.5 },
      { text: "Students can replay exactly how the idea was built, step by step.", startSec: 4.5, endSec: 10.5 },
      { text: "A second GPT-5.6 integration writes the class handout — recap, glossary, comprehension questions.", startSec: 10.5, endSec: 18 },
      { text: "Nothing is invented — it's all from what was actually taught.", startSec: 18, endSec: 24.5 },
    ],
    file: "segment-c-artifacts.mp4",
    startFromSec: 0,
    endAtSec: 25,
    muted: false,
  },
  {
    id: "build-title",
    type: "card",
    targetDurationSec: 4,
    narration: "vo-build-title.mp3",
    // The narration reads the card line itself.
    subtitles: [],
    lines: ["Built with Codex + GPT-5.6."],
  },
  {
    id: "build-story",
    type: "recording",
    targetDurationSec: 30,
    frame: "wide",
    narration: "vo-build-story.mp3",
    subtitles: [
      { text: "The entire product was built with Codex, from a spec committed before the first line of code.", startSec: 0.4, endSec: 6 },
      { text: "Codex built each phase against acceptance criteria — every decision is tagged in a running log.", startSec: 6, endSec: 12 },
      { text: "GPT-5.6 on the Responses API emits strict structured output — add node, add edge, set layout.", startSec: 12, endSec: 19 },
      { text: "Speech becomes an editable graph, not a picture.", startSec: 19, endSec: 24 },
      { text: "Even API constraints are documented as Codex decisions in the log.", startSec: 24, endSec: 29.5 },
    ],
    file: "segment-d-buildstory.mp4",
    startFromSec: 0,
    endAtSec: 30,
    muted: false,
  },
  {
    id: "end-card",
    type: "card",
    targetDurationSec: 8,
    narration: "vo-end-card.mp3",
    subtitles: [
      { text: "For teachers, tutors, and every student who learns by seeing.", startSec: 0.5, endSec: 7.5 },
    ],
    lines: ["Chalk — the board that draws itself.", "Education track — OpenAI Build Week 2026", LIVE_URL, REPO_URL],
  },
] as const;

// Cross-segment transition length. Each transition overlaps its two neighbors, so the rendered
// video is shorter than the sum of segment durations by one transition per boundary.
export const TRANSITION_SEC = 0.5;
export const TRANSITION_FRAMES = Math.round(TRANSITION_SEC * FPS);

export const totalDurationSec = timeline.reduce((sum, segment) => sum + segment.targetDurationSec, 0);
export const segmentDurationInFrames = (segment: Segment) => Math.round(segment.targetDurationSec * FPS);
const transitionCount = Math.max(0, timeline.length - 1);
// The rendered length TransitionSeries produces: summed segments minus every overlapping transition.
export const totalDurationInFrames = timeline.reduce((sum, segment) => sum + segmentDurationInFrames(segment), 0) - transitionCount * TRANSITION_FRAMES;
