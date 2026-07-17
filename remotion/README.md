# Chalk Demo Video

The official OpenAI Build Week submission video for **Chalk — the board that draws itself**. This is a standalone Remotion project inside `D:\Chalk\remotion`; it does not modify the Chalk web application.

## Video contract

- Composition: `ChalkDemo`
- Output: `1920×1080`, `30 fps`, H.264 MP4 (`yuv420p`)
- Content duration: `170 seconds`; rendered length `166 seconds` (`2:46`) — each of the 8 segment boundaries overlaps by a 0.5s crossfade.
- Hard cap: `175 seconds` (`2:55`)
- No music. Narration comes from the recordings' own live audio plus per-segment voiceover files (below).

## Motion design

Segments are sequenced with `@remotion/transitions` (`TransitionSeries`): every boundary is a 0.5s eased crossfade rather than a hard cut, so the composition length is the summed segment durations minus one transition per boundary. Within each segment the motion is spring-based — the background carries a slow amber light sweep and drifting chalk-dust motes; browser frames lift in with a clearing blur and float gently; card and hero text reveal with a staggered blur-in; subtitles rise into place. All motion is deterministic (no `Math.random`/`Date`), so every render is identical. Keep transitions shorter than the shortest segment (4s) if you retime.

All video timing, subtitles, recording trims, playback speeds, narration assignments, and URLs live in [`src/timeline.ts`](src/timeline.ts). The free Google **Space Grotesk** font is bundled in `public/fonts/` and loaded through `@remotion/fonts`, which blocks rendering until the font is ready — final renders need no font network access and never show fallback glyphs.

## How recordings appear

Recordings never play full-bleed. Each one is embedded as a component: a browser-style frame (traffic dots + the live URL in the chrome bar) floating on the Chalk chalkboard background, with a subtitle band below the frame. The hook uses a `hero` layout — the frame sits on the right while the title block ("CHALK / The board that draws itself") occupies the left. All other recordings use the `wide` layout, a large centered frame. The layout is the `frame` field on each recording segment in `src/timeline.ts`.

## Subtitles = the narration script

Every segment carries timed subtitle cues (`subtitles` in `src/timeline.ts`, seconds relative to the segment start). They serve two jobs:

1. **On-screen subtitles** in the final video — an accessibility win that matches Chalk's own pitch.
2. **Teleprompter for recording voiceover:** play the composition in Remotion Studio and read the cues as they appear; each segment's cues are exactly the text of its `vo-*.mp3` file. Title cards (`gesture-title`, `build-title`) intentionally have no cues — their narration reads the card text itself.

Cue timings are estimates — nudge `startSec`/`endSec` after you see the real footage (the voice-build cues at 33s and 44s should line up with the on-camera correction and highlight moments). Cues that overlap, run backwards, or outlast their segment are warned about in Studio and block a final render.

## Recordings to produce

Record at **1920×1080, 30 fps, H.264 MP4**. Keep the supplied filenames exactly, then copy them to `public/recordings/`. Recordings that are not exactly 16:9 are letterboxed inside the frame (`objectFit: contain`), never cropped.

| Segment | Filename | Target length | What to show |
|---|---|---:|---|
| Hook | `hook.mp4` | 8s | Chalk already alive and visually compelling; the title block animates in over the first 3 seconds and stays beside the frame for the whole hook. Muted — `vo-hook.mp3` narrates over it. |
| Voice build | `segment-a-voice-build.mp4` | 55s | A teacher explains the water cycle while the live transcript, nodes, edges, cycle layout, and a correction appear. Live audio is the narration. |
| Gestures | `segment-b-gestures.mp4` | 30s | Webcam PiP, point, pinch-select two nodes, then say “connect these two.” Live audio is the narration. |
| Artifacts | `segment-c-artifacts.mp4` | 25s | Replay, PNG/JSON export, and the GPT-5.6 Markdown handout. Narrated by `vo-artifacts.mp3`; clip audio ducks underneath. |
| Build story | `segment-d-buildstory.mp4` | 30s | The spec-first build story: Codex, the Responses API, strict structured operations, and validation. Narrated by `vo-build-story.mp3`. |

## Narration to produce

Every segment must carry audio — the hackathon requires narration throughout. Segments whose live recording audio is the narration declare `narration: null`; every other segment names a voiceover file in `public/audio/`:

| File | Plays over | Max length |
|---|---|---:|
| `vo-hook.mp3` | hook recording (muted) | 8s |
| `vo-problem.mp3` | problem card | 6s |
| `vo-gesture-title.mp3` | gesture title card | 4s |
| `vo-artifacts.mp3` | artifacts recording (ducked) | 25s |
| `vo-build-title.mp3` | build title card | 4s |
| `vo-build-story.mp3` | build story recording (ducked) | 30s |
| `vo-end-card.mp3` | end card | 8s |

When a narration file is present, the underlying recording ducks to `NARRATION_DUCK_VOLUME` (0.15) instead of muting, so UI sounds stay faintly audible. Narration longer than its segment is flagged by validation because the tail would be cut off. To narrate a segment live in the recording instead, set its `narration` to `null` in `src/timeline.ts`.

To record a voiceover file: open Remotion Studio, play the target segment, and read its subtitles aloud into your recorder — the cues are the script, timed to fit.

Recordings and audio are gitignored (see `.gitignore`) — the repo ships the machinery, YouTube ships the video. Remove those ignore rules or use Git LFS if the raw footage should be committed.

## Placeholder-first workflow and render guards

Before any recordings exist, every recording segment renders as a Chalk-branded slate showing the expected filename, segment id, duration, and destination folder. This lets the complete video render end-to-end immediately.

`npm run prepare-media` (run automatically by `dev`, `studio`, and `render`) scans `public/recordings/` and `public/audio/`, probes each file's duration, and regenerates `src/generated-media.ts`. Restart Studio after adding a file so it re-reads the manifest.

`src/validate.ts` runs at composition load:

- **Always fatal:** timeline over the 175s cap; a trim window (`endAtSec − startFromSec`) shorter than the segment, which would unmount the video and leave an empty frame for the tail.
- **Fatal during `npm run render`, warning in Studio:** missing recordings, missing declared narration, silent segments, narration longer than its segment, recordings shorter than `endAtSec`, media whose duration could not be probed, trim windows longer than the segment (footage silently cut), subtitle-cue timing problems, and placeholder text in the end-card URLs. To deliberately render a draft anyway: `$env:REMOTION_ALLOW_PLACEHOLDERS="1"; npm run render` (PowerShell) or `REMOTION_ALLOW_PLACEHOLDERS=1 npm run render` (bash).

## Trim controls

For every recording entry in `src/timeline.ts`:

```ts
{
  file: "segment-a-voice-build.mp4",
  startFromSec: 0,  // trim from this point in the source clip
  endAtSec: 55,     // stop at this point in the source clip
  muted: false,     // true keeps this clip silent (only sensible with narration)
}
```

Use `startFromSec` and `endAtSec` to select the strongest part of a longer recording; the window should equal the segment's `targetDurationSec` — validation enforces the math. Playback is always real-time: speed-changing footage was deliberately left out because trims and speech pacing silently disagree with it.

## Preview and render

```bash
npm install
npm run studio
```

Use Remotion Studio to preview the `ChalkDemo` composition and inspect the timing/captions. Then render the final file:

```bash
npm run render
```

The output is `out/chalk-demo.mp4`. The `render` script explicitly requests H.264 MP4 and `yuv420p` for broad playback compatibility. A render refuses to produce a non-submission-ready file unless `REMOTION_ALLOW_PLACEHOLDERS=1` is set.

## Remotion license

Remotion is free for individuals (and, under its current free license, small teams up to three people). Review the current [Remotion license](https://www.remotion.dev/license) before using it outside that scope.
