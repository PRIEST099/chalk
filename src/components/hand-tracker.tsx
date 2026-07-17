"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";

export type HandDebug = { gesture: string; pinchDistance: number; point: { x: number; y: number }; fps: number };
type PresenterStatus = "Idle" | "Listening" | "Thinking" | "Drawing";
type Props = {
  active: boolean;
  teacherName: string;
  onTeacherNameChange: (name: string) => void;
  status: PresenterStatus;
  onPoint: (point: { x: number; y: number }) => void;
  onPinch: () => void;
  onSwipeLeft: () => void;
  onError: (message: string) => void;
  onEnabledChange: (enabled: boolean) => void;
  onHandLost: () => void;
  onDebug: (debug: HandDebug) => void;
};

// Pinned to the installed @mediapipe/tasks-vision version — "@latest" could break the app on any upstream release.
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const distance = (a: NormalizedLandmark, b: NormalizedLandmark) => Math.hypot(a.x - b.x, a.y - b.y);

let tfliteLogFilterInstalled = false;
const installTfliteLogFilter = () => {
  if (tfliteLogFilterInstalled) return;
  tfliteLogFilterInstalled = true;
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("INFO: Created TensorFlow Lite")) return;
    original(...args);
  };
};

const HAND_LOST_FRAMES = 15;

function MicGlyph() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5 fill-none stroke-current stroke-[2]"><rect x="8" y="3" width="8" height="12" rx="4" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" /></svg>;
}

export function HandTracker({ active, teacherName, onTeacherNameChange, status, onPoint, onPinch, onSwipeLeft, onError, onEnabledChange, onHandLost, onDebug }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const frameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastFrameRef = useRef(0);
  const fpsRef = useRef({ at: 0, frames: 0, value: 0 });
  const smoothRef = useRef<{ x: number; y: number } | null>(null);
  const pinchActiveRef = useRef(false);
  const pinchCooldownRef = useRef(0);
  const swipeCooldownRef = useRef(0);
  const wristRef = useRef<{ x: number; at: number } | null>(null);
  const processRef = useRef<(now: number) => void>(() => undefined);
  const [enabled, setEnabled] = useState(false);
  const [starting, setStarting] = useState(false);
  const enabledChangeRef = useRef(onEnabledChange);
  const noHandFramesRef = useRef(0);
  const sessionRef = useRef(0);

  useEffect(() => { enabledChangeRef.current = onEnabledChange; }, [onEnabledChange]);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    noHandFramesRef.current = 0;
    setStarting(false);
    setEnabled(false);
    enabledChangeRef.current(false);
  }, []);

  const process = useCallback((now: number) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !canvas || !landmarker) return;
    if (now - lastFrameRef.current < 33) {
      frameRef.current = requestAnimationFrame((time) => processRef.current(time));
      return;
    }
    lastFrameRef.current = now;
    const result = landmarker.detectForVideo(video, now);
    const hand = result.landmarks[0];
    const fps = fpsRef.current;
    fps.frames += 1;
    if (now - fps.at > 1000) {
      fps.value = (fps.frames * 1000) / Math.max(now - fps.at, 1);
      fps.frames = 0;
      fps.at = now;
    }
    const context = canvas.getContext("2d");
    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (hand) {
        context.fillStyle = "#f5f0df";
        for (const landmark of hand) {
          context.beginPath();
          context.arc(landmark.x * canvas.width, landmark.y * canvas.height, 3, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
    if (hand) {
      noHandFramesRef.current = 0;
      const handSize = Math.max(distance(hand[0], hand[9]), 0.01);
      const pinchDistance = distance(hand[4], hand[8]) / handSize;
      const indexExtended = distance(hand[8], hand[0]) > distance(hand[6], hand[0]) * 1.12;
      const openPalm = [8, 12, 16, 20].every((tip, index) => distance(hand[tip], hand[0]) > distance(hand[[6, 10, 14, 18][index]], hand[0]) * 1.1);
      const raw = { x: 1 - hand[8].x, y: hand[8].y };
      const previous = smoothRef.current;
      const smooth = previous ? { x: previous.x * 0.72 + raw.x * 0.28, y: previous.y * 0.72 + raw.y * 0.28 } : raw;
      smoothRef.current = smooth;
      if (indexExtended) onPoint(smooth);
      if (!pinchActiveRef.current && pinchDistance < 0.32 && now - pinchCooldownRef.current > 650) {
        pinchActiveRef.current = true;
        pinchCooldownRef.current = now;
        onPinch();
      }
      if (pinchActiveRef.current && pinchDistance > 0.44) pinchActiveRef.current = false;
      const previousWrist = wristRef.current;
      const velocity = previousWrist ? (previousWrist.x - hand[0].x) / Math.max((now - previousWrist.at) / 1000, 0.001) : 0;
      if (openPalm && velocity < -1.1 && now - swipeCooldownRef.current > 900) {
        swipeCooldownRef.current = now;
        onSwipeLeft();
      }
      wristRef.current = { x: hand[0].x, at: now };
      onDebug({ gesture: pinchActiveRef.current ? "Pinch" : openPalm ? "Open palm" : indexExtended ? "Point" : "Tracking", pinchDistance, point: smooth, fps: fps.value });
    } else {
      noHandFramesRef.current += 1;
      if (noHandFramesRef.current === HAND_LOST_FRAMES) {
        smoothRef.current = null;
        wristRef.current = null;
        onHandLost();
      }
      onDebug({ gesture: "No hand", pinchDistance: 0, point: smoothRef.current ?? { x: 0, y: 0 }, fps: fps.value });
    }
    frameRef.current = requestAnimationFrame((time) => processRef.current(time));
  }, [onDebug, onHandLost, onPinch, onPoint, onSwipeLeft]);

  useEffect(() => { processRef.current = process; }, [process]);

  const enable = useCallback(async () => {
    if (streamRef.current || landmarkerRef.current || starting) return;
    const session = ++sessionRef.current;
    setStarting(true);
    try {
      installTfliteLogFilter();
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = videoRef.current;
      if (session !== sessionRef.current || !video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      const landmarker = await HandLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: MODEL_URL }, runningMode: "VIDEO", numHands: 1 });
      if (session !== sessionRef.current) {
        landmarker.close();
        return;
      }
      landmarkerRef.current = landmarker;
      fpsRef.current.at = performance.now();
      setEnabled(true);
      enabledChangeRef.current(true);
      frameRef.current = requestAnimationFrame(process);
    } catch {
      if (session === sessionRef.current) {
        stop();
        onError("Camera access was denied or unavailable. Mouse controls are ready instead.");
      }
    } finally {
      if (session === sessionRef.current) setStarting(false);
    }
  }, [onError, process, starting, stop]);

  useEffect(() => {
    const timer = window.setTimeout(() => { if (active) void enable(); else stop(); }, 0);
    return () => window.clearTimeout(timer);
  }, [active, enable, stop]);
  useEffect(() => stop, [stop]);

  const initials = useMemo(() => teacherName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "T", [teacherName]);
  const micTone = status === "Listening" ? "bg-emerald-400 text-emerald-100 shadow-[0_0_14px_rgba(74,222,128,.85)]" : status === "Thinking" || status === "Drawing" ? "animate-pulse bg-[#e6a75b] text-[#172326]" : "bg-white/10 text-[#93a39d]";

  return <section className="absolute bottom-3 right-3 z-20 w-[9.5rem] overflow-hidden rounded-2xl border border-white/20 bg-[#101a1c] shadow-2xl shadow-black/40 sm:bottom-5 sm:right-5 sm:w-[224px]">
    <div className="relative aspect-[16/10] bg-[#1d2d2e]">
      <div className={`absolute inset-0 -scale-x-100 transition-opacity ${enabled ? "opacity-100" : "opacity-0"}`}><video ref={videoRef} muted playsInline className="h-full w-full object-cover" /><canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" /></div>
      {!enabled && <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_20%,#39514d,transparent_55%),#172326]"><div className="grid size-11 place-items-center rounded-full border border-[#e6a75b]/35 bg-[#e6a75b]/15 text-base font-semibold tracking-wide text-[#f3c887] sm:size-16 sm:text-xl">{initials}</div><span className="absolute bottom-2 text-[10px] text-[#a8b3ad] sm:bottom-4 sm:text-xs">{starting ? "Starting camera…" : "Camera off"}</span></div>}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-5 sm:px-3 sm:pb-2.5 sm:pt-7"><div className="min-w-0"><input aria-label="Presenter name" value={teacherName} onChange={(event) => onTeacherNameChange(event.target.value)} className="w-full bg-transparent text-xs font-semibold text-[#f5f0df] outline-none placeholder:text-[#f5f0df]/65 sm:text-sm" placeholder="Teacher" /><p className="text-[9px] uppercase tracking-[0.16em] text-[#c4cfca] sm:text-[10px]">Presenter</p></div><span title={status === "Idle" ? "Microphone stopped" : `${status} microphone`} className={`ml-2 grid size-6 shrink-0 place-items-center rounded-full border border-white/20 sm:size-7 ${micTone}`}><MicGlyph /></span></div>
    </div>
  </section>;
}
