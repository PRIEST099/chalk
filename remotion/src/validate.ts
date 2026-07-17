import { getRemotionEnvironment } from "remotion";
import { LIVE_URL, MAX_DURATION_SEC, REPO_URL, timeline, totalDurationSec, type RecordingSegment, type Segment } from "./timeline";
import { availableAudioFiles, availableRecordingFiles, mediaDurationsSec } from "./generated-media";

const TOLERANCE_SEC = 0.05;

// Cue timing is content tuning, not corruption — report as draft problems so Studio stays usable while retiming.
const subtitleProblems = (segment: Segment): string[] => {
  const problems: string[] = [];
  segment.subtitles.forEach((cue, index) => {
    if (cue.startSec >= cue.endSec) problems.push(`Segment "${segment.id}" subtitle ${index + 1} ends before it starts (${cue.startSec}s–${cue.endSec}s).`);
    if (cue.endSec > segment.targetDurationSec + TOLERANCE_SEC) problems.push(`Segment "${segment.id}" subtitle ${index + 1} runs to ${cue.endSec}s but the segment lasts ${segment.targetDurationSec}s.`);
    const previous = segment.subtitles[index - 1];
    if (previous && cue.startSec < previous.endSec - TOLERANCE_SEC) problems.push(`Segment "${segment.id}" subtitles ${index} and ${index + 1} overlap (${previous.endSec}s vs ${cue.startSec}s) — only the earlier cue would show.`);
  });
  return problems;
};

const trimProblems = (segment: RecordingSegment): string[] => {
  const problems: string[] = [];
  if (segment.endAtSec <= segment.startFromSec) problems.push(`Segment "${segment.id}" trims to nothing (startFromSec ${segment.startFromSec} >= endAtSec ${segment.endAtSec}).`);
  const windowSec = segment.endAtSec - segment.startFromSec;
  if (windowSec + TOLERANCE_SEC < segment.targetDurationSec) problems.push(`Segment "${segment.id}" declares only ${windowSec.toFixed(2)}s of source but the sequence lasts ${segment.targetDurationSec}s — the video would unmount and leave an empty frame for the tail. Extend endAtSec.`);
  return problems;
};

/**
 * Structural timeline bugs always throw. Missing media, placeholder text, and draft-quality problems
 * throw only during a render (set REMOTION_ALLOW_PLACEHOLDERS=1 for a deliberate draft) and warn in
 * Studio, where slates and estimated timings are expected while footage is still being produced.
 */
export function validateTimeline(): void {
  const structural: string[] = [];
  const placeholders: string[] = [];

  if (totalDurationSec > MAX_DURATION_SEC) structural.push(`Timeline is ${totalDurationSec}s, exceeding the ${MAX_DURATION_SEC}s hard cap.`);
  for (const url of [LIVE_URL, REPO_URL]) if (url.includes("<")) placeholders.push(`End-card URL still contains a placeholder: ${url}`);

  for (const segment of timeline) {
    placeholders.push(...subtitleProblems(segment));
    const narrationAvailable = segment.narration !== null && availableAudioFiles.includes(segment.narration);
    if (segment.narration !== null && !narrationAvailable) placeholders.push(`Segment "${segment.id}" declares narration audio/${segment.narration}, but the file is missing.`);
    if (narrationAvailable) {
      const narrationSec = mediaDurationsSec[`audio/${segment.narration}`];
      if (narrationSec === undefined) placeholders.push(`audio/${segment.narration} exists but its duration could not be read — the narration-cutoff check was skipped. Re-encode the file or re-run prepare-media.`);
      else if (narrationSec > segment.targetDurationSec + TOLERANCE_SEC) placeholders.push(`audio/${segment.narration} is ${narrationSec.toFixed(2)}s but segment "${segment.id}" lasts ${segment.targetDurationSec}s — the narration would be cut off.`);
    }
    if (segment.type === "card") {
      if (segment.narration === null) placeholders.push(`Card segment "${segment.id}" has no narration, so it renders silent.`);
      continue;
    }
    structural.push(...trimProblems(segment));
    const windowSec = segment.endAtSec - segment.startFromSec;
    if (windowSec - TOLERANCE_SEC > segment.targetDurationSec) placeholders.push(`Segment "${segment.id}" declares ${windowSec.toFixed(2)}s of source but lasts ${segment.targetDurationSec}s — the extra footage (and its audio) is cut at the sequence boundary.`);
    if (segment.file === null || !availableRecordingFiles.includes(segment.file)) {
      placeholders.push(`Segment "${segment.id}" has no recording (${segment.file ?? "no file declared"} not in public/recordings/) and renders as a placeholder slate.`);
      continue;
    }
    const sourceSec = mediaDurationsSec[`recordings/${segment.file}`];
    if (sourceSec === undefined) placeholders.push(`recordings/${segment.file} exists but its duration could not be read — the trim check was skipped. Re-encode the file or re-run prepare-media.`);
    else if (sourceSec + TOLERANCE_SEC < segment.endAtSec) placeholders.push(`recordings/${segment.file} is ${sourceSec.toFixed(2)}s but segment "${segment.id}" trims up to ${segment.endAtSec}s — the tail would freeze on the last frame.`);
    if (segment.muted && !narrationAvailable) placeholders.push(`Segment "${segment.id}" is muted with no narration, so it renders silent.`);
  }

  if (structural.length > 0) throw new Error(`Chalk demo timeline is invalid:\n- ${structural.join("\n- ")}`);
  if (placeholders.length === 0) return;
  const message = `Chalk demo is not submission-ready:\n- ${placeholders.join("\n- ")}`;
  if (getRemotionEnvironment().isRendering && process.env.REMOTION_ALLOW_PLACEHOLDERS !== "1") {
    throw new Error(`${message}\nSet REMOTION_ALLOW_PLACEHOLDERS=1 to render a draft anyway.`);
  }
  console.warn(message);
}
